"use server";

import { sendNotifications } from "@/lib/notifications.server";
import {
  fillFreeSpots,
  getChoicesByVoteId,
  getSlotArrays,
  normalizeChoices,
  registerVote,
  repairDeletedVotes,
  slotsOrderBy,
} from "@/lib/registration";
import { ActionError, action } from "@/lib/safe-action";
import {
  createVoteSchema,
  deleteVoteSchema,
  updateVoteNameSchema,
} from "@/lib/schema/vote-schema";
import { checkTimeBeforeAllow } from "@/lib/utils";
import { prisma, withPollLock } from "@/prisma/db";
import { Prisma } from "@prisma/client";

export const createVote = action
  .inputSchema(createVoteSchema)
  .action(async ({ parsedInput: data }) => {
    const registration = await withPollLock(data.pollId, async (tx) => {
      const poll = await tx.poll.findUnique({
        where: { id: data.pollId },
        include: {
          slots: {
            orderBy: slotsOrderBy,
          },
        },
      });
      if (!poll) throw new ActionError("Ce sondage n'existe plus");

      // one choice per slot of this poll
      const isOneChoicePerSlot =
        data.choices.length === poll.slots.length &&
        poll.slots.every(
          (slot) =>
            data.choices.filter((choice) => choice.slotId === slot.id)
              .length === 1,
        );
      if (!isOneChoicePerSlot)
        throw new ActionError(
          "Les créneaux du sondage ont changé, vérifiez vos choix",
        );

      // yes, no (or maybe in a free poll)
      const validChoices = poll.type === 2 ? [1, 2] : [1, 2, 3];
      if (!data.choices.every((choice) => validChoices.includes(choice.choice)))
        throw new ActionError("Choix invalides");

      const initialPoll = JSON.parse(
        JSON.stringify(poll.slots),
      ) as PollWithSlots["slots"];

      const timeBeforeAllowedPassed = checkTimeBeforeAllow({
        timeBeforeAllowedType: poll.timeBeforeAllowedType,
        msBeforeAllowed: poll.msBeforeAllowed,
        slots: poll.slots,
      });

      // before updating the vote, while the arrays match the stored choices
      if (poll.type === 2) {
        repairDeletedVotes({
          slots: poll.slots,
          votes: await tx.vote.findMany({
            where: { pollId: poll.id },
            select: {
              id: true,
              choices: {
                select: { slotId: true, choice: true, priority: true },
              },
            },
          }),
          timeBeforeAllowedPassed,
        });
      }

      const voteInDB = await tx.vote.findUnique({
        where: { id: data.id },
        select: {
          pollId: true,
          choices: {
            select: {
              slotId: true,
              choice: true,
              priority: true,
            },
          },
        },
      });

      // an existing vote can only be edited in its own poll
      if (voteInDB && voteInDB.pollId !== data.pollId)
        throw new ActionError("Ce vote n'appartient pas à ce sondage");

      // the choice ids sent by the client are ignored: an edit updates the
      // stored choice of each slot (one per vote and slot, @@unique)
      const choices = normalizeChoices({
        choices: data.choices,
        storedChoices: voteInDB?.choices,
        pollType: poll.type,
      });

      // UPDATE VOTE IN DB
      await tx.vote.upsert({
        where: {
          id: data.id,
        },
        update: {
          name: data.name,
          choices: {
            upsert: choices.map((choice) => ({
              where: {
                voteId_slotId: { voteId: data.id, slotId: choice.slotId },
              },
              update: {
                choice: choice.choice,
                priority: choice.priority,
              },
              create: {
                choice: choice.choice,
                priority: choice.priority,
                slot: {
                  connect: {
                    id: choice.slotId,
                  },
                },
              },
            })),
          },
          subscriptions: data.subscription
            ? {
                connectOrCreate: {
                  where: { endpoint: data.subscription.endpoint },
                  create: {
                    ...data.subscription,
                  },
                },
              }
            : undefined,
        },
        create: {
          id: data.id,
          name: data.name,
          poll: {
            connect: {
              id: data.pollId,
            },
          },
          choices: {
            create: choices.map((choice) => ({
              choice: choice.choice,
              priority: choice.priority,
              slot: {
                connect: {
                  id: choice.slotId,
                },
              },
            })),
          },
          subscriptions: data.subscription
            ? {
                connectOrCreate: {
                  where: { endpoint: data.subscription.endpoint },
                  create: {
                    ...data.subscription,
                  },
                },
              }
            : undefined,
        },
      });

      if (poll.type === 2) {
        // choices of every vote, this one included, as just stored
        const votes = await tx.vote.findMany({
          where: { pollId: poll.id },
          select: {
            id: true,
            choices: { select: { slotId: true, choice: true, priority: true } },
          },
        });

        registerVote({
          slots: poll.slots,
          voteId: data.id,
          choices,
          oldChoices: voteInDB?.choices,
          choicesByVoteId: getChoicesByVoteId(votes),
          timeBeforeAllowedPassed,
        });

        // update slots in db
        for (const slot of poll.slots) {
          await tx.slot.update({
            where: { id: slot.id },
            data: getSlotArrays(slot),
          });
        }

        return { poll, newPoll: poll, initialPoll };
      }
    });

    if (registration) {
      sendNotifications({
        voteId: data.id,
        pollId: data.pollId,
        ...registration,
      }).catch((err) => console.log(err));
    }

    return { success: true };
  });

export const deleteVote = action
  .inputSchema(deleteVoteSchema)
  .action(async ({ parsedInput: { voteId, pollId } }) => {
    const registration = await withPollLock(pollId, async (tx) => {
      // only a vote of this poll
      const vote = await tx.vote.findFirst({
        where: { id: voteId, pollId },
        select: { id: true },
      });
      if (!vote) throw new ActionError("Ce vote a déjà été supprimé");

      let registrationUpdate:
        | {
            poll: PollWithSlots;
            newPoll: PollWithSlots;
            initialPoll: PollWithSlots["slots"];
          }
        | undefined = undefined;

      const poll = await tx.poll.findUnique({
        where: { id: pollId },
        include: {
          slots: {
            orderBy: slotsOrderBy,
          },
        },
      });
      if (!poll) throw new ActionError("Ce sondage n'existe plus");

      // REMOVE VOTE FROM ALL SLOTS ARRAYS
      if (poll.type === 2) {
        const initialPoll = JSON.parse(
          JSON.stringify(poll.slots),
        ) as PollWithSlots["slots"];

        const timeBeforeAllowedPassed = checkTimeBeforeAllow({
          timeBeforeAllowedType: poll.timeBeforeAllowedType,
          msBeforeAllowed: poll.msBeforeAllowed,
          slots: poll.slots,
        });

        const votes = await tx.vote.findMany({
          where: { pollId },
          select: {
            id: true,
            choices: { select: { slotId: true, choice: true, priority: true } },
          },
        });

        // before removing the vote, while the arrays match the stored choices
        repairDeletedVotes({
          slots: poll.slots,
          votes,
          timeBeforeAllowedPassed,
        });

        // remove vote from all slots arrays
        poll.slots.forEach((slot) => {
          slot.registered = slot.registered.filter((id) => id != voteId);
          slot.waitingList = slot.waitingList.filter((id) => id != voteId);
          slot.waitingListReregistered = slot.waitingListReregistered.filter(
            (id) => id != voteId,
          );
          slot.notComing = slot.notComing.filter((id) => id != voteId);
        });

        // the first of the waiting lists get the freed spots
        fillFreeSpots({
          slots: poll.slots,
          choicesByVoteId: getChoicesByVoteId(votes),
          timeBeforeAllowedPassed,
        });

        // people registered by the repair or the cascade
        registrationUpdate = { poll, newPoll: poll, initialPoll };

        // update slots in db
        for (const slot of poll.slots) {
          await tx.slot.update({
            where: { id: slot.id },
            data: getSlotArrays(slot),
          });
        }
      }

      await tx.voteChoice.deleteMany({ where: { voteId } });

      await tx.vote.delete({
        where: { id: voteId },
      });

      return registrationUpdate;
    });

    if (registration) {
      sendNotifications({ voteId, pollId, ...registration }).catch((err) =>
        console.log(err),
      );
    }

    return { success: true };
  });

export const updateVoteName = action
  .inputSchema(updateVoteNameSchema)
  .action(async ({ parsedInput: { voteId, name, subscription } }) => {
    await prisma.vote.update({
      where: { id: voteId },
      data: {
        name,
        subscriptions: {
          connectOrCreate: subscription
            ? {
                where: { endpoint: subscription.endpoint },
                create: {
                  ...subscription,
                },
              }
            : undefined,
        },
      },
    });

    return { success: true };
  });

export type PollWithSlots = Prisma.PollGetPayload<{ include: { slots: true } }>;
