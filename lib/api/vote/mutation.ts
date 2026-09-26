"use server";

import { sendNotifications } from "@/lib/notifications.server";
import {
  getSlotArrays,
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
  .schema(createVoteSchema)
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
              choices: { select: { slotId: true, choice: true } },
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
              id: true,
              slotId: true,
              choice: true,
            },
          },
        },
      });

      // an existing vote can only be edited in its own poll
      if (voteInDB && voteInDB.pollId !== data.pollId)
        throw new ActionError("Ce vote n'appartient pas à ce sondage");

      // UPDATE VOTE IN DB
      await tx.vote.upsert({
        where: {
          id: data.id,
        },
        update: {
          name: data.name,
          choices: {
            upsert: data.choices.map(
              (choice: { id: string; slotId: string; choice: number }) => ({
                where: {
                  id: choice.id,
                },
                update: {
                  choice: choice.choice,
                },
                create: {
                  id: choice.id,
                  choice: choice.choice,
                  slot: {
                    connect: {
                      id: choice.slotId,
                    },
                  },
                },
              }),
            ),
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
            create: data.choices.map(
              (choice: { id: string; slotId: string; choice: number }) => ({
                id: choice.id,
                choice: choice.choice,
                slot: {
                  connect: {
                    id: choice.slotId,
                  },
                },
              }),
            ),
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
        const newPoll = await updateSlotsArrayAfterCreation({
          tx,
          poll,
          timeBeforeAllowedPassed,
          voteId: data.id,
          initialVoteChoices: data.choices,
          initialVoteOldChoices: voteInDB?.choices,
          firstCall: true,
          voteExists: !!voteInDB,
        });

        // update slots in db
        for (const slot of newPoll.slots) {
          await tx.slot.update({
            where: { id: slot.id },
            data: getSlotArrays(slot),
          });
        }

        return { poll, newPoll, initialPoll };
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

const updateSlotsArrayAfterCreation = async ({
  tx,
  poll,
  voteId,
  initialVoteChoices,
  initialVoteOldChoices,
  voteExists,
  timeBeforeAllowedPassed,
  firstCall,
}: {
  tx: Prisma.TransactionClient;
  poll: PollWithSlots;
  voteId: string;
  initialVoteChoices: Choice[];
  initialVoteOldChoices?: Choice[];
  voteExists: boolean;
  timeBeforeAllowedPassed: Record<string, boolean>;
  firstCall?: boolean;
}): Promise<PollWithSlots> => {
  let isRegisteredOnce = false;

  // check si le vote existe (uniquement pour celui reçu dans l'api)
  const currentVoteData = await tx.vote.findUnique({
    where: { id: voteId },
    select: {
      choices: {
        select: {
          id: true,
          slotId: true,
          choice: true,
        },
      },
    },
  });

  for (const slot of poll.slots) {
    const timePassed = timeBeforeAllowedPassed[slot.id];
    const currentVoteChoice = [
      ...(firstCall ? initialVoteChoices : currentVoteData!.choices),
    ].find((choice) => choice.slotId === slot.id);
    const isChoiceNo = currentVoteChoice?.choice == 2;

    const isAllowedToRegister = () => !isRegisteredOnce || timePassed;
    const isFull = () => slot.registered.length >= slot.maxParticipants;

    // if its an edit
    if (voteExists) {
      const oldChoice = firstCall
        ? initialVoteOldChoices!.find((choice) => choice.slotId === slot.id)!
        : undefined;
      const choiceChanged = firstCall
        ? oldChoice?.choice !== currentVoteChoice?.choice
        : false;

      if (choiceChanged) {
        slot.registered = slot.registered.filter((id) => id !== voteId);
        slot.waitingList = slot.waitingList.filter((id) => id !== voteId);
        slot.waitingListReregistered = slot.waitingListReregistered.filter(
          (id) => id !== voteId,
        );
        slot.notComing = slot.notComing.filter((id) => id !== voteId);
      } else {
        if (currentVoteChoice?.choice == 1) {
          const isRegistered = slot.registered.includes(voteId);

          // premier créneau où il est inscrit, on le laisse inscrit
          if (isRegistered && !isRegisteredOnce) {
            isRegisteredOnce = true;
            continue;
          }
          // déjà inscrit dans un créneau précédent, on l'enlève des inscrits
          // (passera en liste d'attente dans la logique suivante)
          else if (isRegistered && isRegisteredOnce) {
            // if time passed and reregistered allowed we can leave it
            if (timePassed) {
              isRegisteredOnce = true;
              continue;
            }
            // else remove from registered (will be in reregistered waiting list)
            else
              slot.registered = slot.registered.filter((id) => id !== voteId);
          }
          // not registered yet -> actually in wl or wlr
          else {
            const isWaitingList = slot.waitingList.includes(voteId);
            const isWaitingListReregistered =
              slot.waitingListReregistered.includes(voteId);

            if (isFull()) {
              // if allowed to reregister -> must be in wl
              if (isAllowedToRegister()) {
                if (isWaitingListReregistered)
                  slot.waitingListReregistered =
                    slot.waitingListReregistered.filter((id) => id !== voteId);
                else continue;
              }
              // else -> must be in wlr
              else {
                if (isWaitingList)
                  slot.waitingList = slot.waitingList.filter(
                    (id) => id !== voteId,
                  );
                else continue;
              }
            } else {
              // if allowed to reregister -> remove from all wl -> will be in registered
              if (isAllowedToRegister()) {
                slot.waitingListReregistered =
                  slot.waitingListReregistered.filter((id) => id !== voteId);
                slot.waitingList = slot.waitingList.filter(
                  (id) => id !== voteId,
                );
              }
              // else -> must be in wlr
              else {
                if (isWaitingList)
                  slot.waitingList = slot.waitingList.filter(
                    (id) => id !== voteId,
                  );
                else continue;
              }
            }
          }
        }
        // no changes if still no
        else continue;
      }
    }

    if (isChoiceNo) slot.notComing.push(voteId);
    else {
      // not full -> add to registered
      if (!isFull() && isAllowedToRegister()) {
        slot.registered.push(voteId);
        isRegisteredOnce = true;
      }
      // full and not registered anywhere -> add to waiting list
      else if (isAllowedToRegister()) slot.waitingList.push(voteId);
      // already registered somewhere -> add to reregistered waiting list
      else slot.waitingListReregistered.push(voteId);
    }
  }

  // ----- CHECK SI IL RESTE DE LA PLACE DANS LES INSCRITS D'UN CRENEAU -----
  let voteIdToRegister = "";
  poll.slots.forEach((slot) => {
    const isNotFull = slot.registered.length < slot.maxParticipants;
    const isWaitingListNotEmpty = slot.waitingList.length > 0;

    if (isNotFull && isWaitingListNotEmpty) {
      voteIdToRegister = slot.waitingList[0];
    }
  });

  if (voteIdToRegister) {
    poll = await updateSlotsArrayAfterCreation({
      tx,
      poll,
      voteId: voteIdToRegister,
      initialVoteChoices,
      voteExists: true,
      timeBeforeAllowedPassed,
    });
  }

  return poll;
};

export const deleteVote = action
  .schema(deleteVoteSchema)
  .action(async ({ parsedInput: { voteId, pollId } }) => {
    const registration = await withPollLock(pollId, async (tx) => {
      // only a vote of this poll
      const vote = await tx.vote.findFirst({
        where: { id: voteId, pollId },
        select: { id: true },
      });
      if (!vote) throw new ActionError("Ce vote a déjà été supprimé");

      let newPoll: PollWithSlots | undefined = undefined;
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

        // before removing the vote, while the arrays match the stored choices
        repairDeletedVotes({
          slots: poll.slots,
          votes: await tx.vote.findMany({
            where: { pollId },
            select: {
              id: true,
              choices: { select: { slotId: true, choice: true } },
            },
          }),
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
        newPoll = JSON.parse(JSON.stringify(poll)) as PollWithSlots;

        // check if someone can be registered
        let voteIdToRegister = "";
        poll.slots.forEach((slot) => {
          if (slot.registered.length < slot.maxParticipants) {
            if (slot.waitingList.length > 0) {
              voteIdToRegister = slot.waitingList[0];
            }
          }
        });

        if (voteIdToRegister) {
          newPoll = await updateSlotsArrayAfterDelete({
            tx,
            poll,
            voteId: voteIdToRegister,
            timeBeforeAllowedPassed,
          });
        }

        // people registered by the repair or the recursion
        registrationUpdate = { poll, newPoll, initialPoll };

        // update slots in db
        for (const slot of newPoll.slots) {
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

const updateSlotsArrayAfterDelete = async ({
  tx,
  poll,
  voteId,
  timeBeforeAllowedPassed,
}: {
  tx: Prisma.TransactionClient;
  poll: PollWithSlots;
  voteId: string;
  timeBeforeAllowedPassed: Record<string, boolean>;
}): Promise<PollWithSlots> => {
  let isRegisteredOnce = false;

  const currentVoteData = await tx.vote.findUnique({
    where: { id: voteId },
    select: {
      choices: {
        select: {
          id: true,
          slotId: true,
          choice: true,
        },
      },
    },
  });

  for (const slot of poll.slots) {
    const timePassed = timeBeforeAllowedPassed[slot.id];
    const currentVoteChoice = currentVoteData!.choices.find(
      (choice) => choice.slotId === slot.id,
    );

    const isAllowedToRegister = () => !isRegisteredOnce || timePassed;
    const isFull = () => slot.registered.length >= slot.maxParticipants;

    if (currentVoteChoice?.choice == 1) {
      const isRegistered = slot.registered.includes(voteId);

      // premier créneau où il est inscrit, on le laisse inscrit
      if (isRegistered && !isRegisteredOnce) {
        isRegisteredOnce = true;
        continue;
      }
      // déjà inscrit dans un créneau précédent, on l'enlève des inscrits
      // (passera en liste d'attente dans la logique suivante)
      else if (isRegistered && isRegisteredOnce) {
        // if time passed and reregistered allowed we can leave it
        if (timePassed) {
          isRegisteredOnce = true;
          continue;
        }
        // else remove from registered (will be in reregistered waiting list)
        else slot.registered = slot.registered.filter((id) => id !== voteId);
      }
      // not registered yet -> actually in wl or wlr
      else {
        const isWaitingList = slot.waitingList.includes(voteId);
        const isWaitingListReregistered =
          slot.waitingListReregistered.includes(voteId);

        if (isFull()) {
          // if allowed to reregister -> must be in wl
          if (isAllowedToRegister()) {
            if (isWaitingListReregistered)
              slot.waitingListReregistered =
                slot.waitingListReregistered.filter((id) => id !== voteId);
            else continue;
          }
          // else -> must be in wlr
          else {
            if (isWaitingList)
              slot.waitingList = slot.waitingList.filter((id) => id !== voteId);
            else continue;
          }
        } else {
          // if allowed to reregister -> remove from all wl -> will be in registered
          if (isAllowedToRegister()) {
            slot.waitingListReregistered = slot.waitingListReregistered.filter(
              (id) => id !== voteId,
            );
            slot.waitingList = slot.waitingList.filter((id) => id !== voteId);
          }
          // else -> must be in wlr
          else {
            if (isWaitingList)
              slot.waitingList = slot.waitingList.filter((id) => id !== voteId);
            else continue;
          }
        }
      }
    }
    // no changes if still no
    else continue;

    // not full -> add to registered
    if (!isFull() && isAllowedToRegister()) {
      slot.registered.push(voteId);
      isRegisteredOnce = true;
    }
    // full and not registered anywhere -> add to waiting list
    else if (isAllowedToRegister()) slot.waitingList.push(voteId);
    // already registered somewhere -> add to reregistered waiting list
    else slot.waitingListReregistered.push(voteId);
  }

  // ----- CHECK SI IL RESTE DE LA PLACE DANS LES INSCRITS D'UN CRENEAU -----
  let voteIdToRegister = "";
  poll.slots.forEach((slot) => {
    const isNotFull = slot.registered.length < slot.maxParticipants;
    const isWaitingListNotEmpty = slot.waitingList.length > 0;

    if (isNotFull && isWaitingListNotEmpty) {
      voteIdToRegister = slot.waitingList[0];
      return;
    }
  });

  if (voteIdToRegister) {
    poll = await updateSlotsArrayAfterDelete({
      tx,
      poll,
      voteId: voteIdToRegister,
      timeBeforeAllowedPassed,
    });
  }

  return poll;
};

export const updateVoteName = action
  .schema(updateVoteNameSchema)
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
type Choice = {
  id: string;
  slotId: string;
  choice: number;
};
