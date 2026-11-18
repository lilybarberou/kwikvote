"use server";

import {
  sendNotifications,
  sendSlotUpdateNotifications,
} from "@/lib/notifications.server";
import {
  compareSlots,
  getChoicesByVoteId,
  getCronSchedulesData,
  getSlotArrays,
  reconcileSlotsArrays,
  removeDeletedVotes,
  repairDeletedVotes,
  slotsOrderBy,
} from "@/lib/registration";
import { ActionError, pollPwAction } from "@/lib/safe-action";
import { updateSlotSchema } from "@/lib/schema/slot-schema";
import { checkTimeBeforeAllow } from "@/lib/utils";
import { withPollLock } from "@/prisma/db";
import { z } from "zod";

import { PollWithSlots } from "../vote/mutation";

export const deleteSlotById = pollPwAction
  .schema(async (s) => s.extend({ slotId: z.string() }))
  .action(async ({ parsedInput: { pollId, slotId } }) => {
    const registration = await withPollLock(pollId, async (tx) => {
      // only a slot of the poll whose password was checked
      const { count } = await tx.slot.deleteMany({
        where: { id: slotId, pollId },
      });
      if (!count) throw new ActionError("Ce créneau a déjà été supprimé");

      const poll = await tx.poll.findUnique({
        where: { id: pollId },
        include: {
          slots: {
            orderBy: slotsOrderBy,
          },
        },
      });
      if (!poll) return;

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

      repairDeletedVotes({
        slots: poll.slots,
        votes,
        timeBeforeAllowedPassed,
      });

      // people registered on the deleted slot are reregistered elsewhere and
      // may now have a spot: same rules as a slot dates update
      reconcileSlotsArrays({
        slots: poll.slots,
        choicesByVoteId: getChoicesByVoteId(votes),
        timeBeforeAllowedPassed,
      });
      const newPoll = poll;

      // update changed slots in db
      for (const slot of newPoll.slots) {
        const initialSlot = initialPoll.find((s) => s.id === slot.id)!;
        if (
          JSON.stringify(getSlotArrays(slot)) ===
          JSON.stringify(getSlotArrays(initialSlot))
        )
          continue;

        await tx.slot.update({
          where: { id: slot.id },
          data: getSlotArrays(slot),
        });
      }

      // people registered by the repair or the reconcile
      return {
        poll: newPoll,
        pollId: poll.id,
        // nobody to leave out: nobody voted, everyone registered is notified
        voteId: "",
        initialPoll,
        newPoll,
      };
    });

    if (registration) {
      sendNotifications(registration).catch((err) => console.log(err));
    }

    return { success: true };
  });

export const updateSlotById = pollPwAction
  .schema(async (s) =>
    s.merge(updateSlotSchema).refine((data) => data.endDate > data.startDate, {
      message: "End date must be after start date",
      path: ["endDate"],
    }),
  )
  .action(
    async ({
      parsedInput: { pollId, slotId, startDate, endDate, exceptEndpoint },
    }) => {
      const update = await withPollLock(pollId, async (tx) => {
        const poll = await tx.poll.findUnique({
          where: { id: pollId },
          include: {
            slots: {
              orderBy: slotsOrderBy,
            },
          },
        });

        const slot = poll?.slots.find((slot) => slot.id === slotId);
        if (!poll || !slot) throw new ActionError("Ce créneau n'existe plus");

        const oldSlot = { startDate: slot.startDate, endDate: slot.endDate };
        const isStartDateUpdated =
          slot.startDate.getTime() !== startDate.getTime();
        const isEndDateUpdated = slot.endDate.getTime() !== endDate.getTime();
        if (!isStartDateUpdated && !isEndDateUpdated) return;

        const initialPoll = JSON.parse(
          JSON.stringify(poll.slots),
        ) as PollWithSlots["slots"];

        slot.startDate = startDate;
        slot.endDate = endDate;
        poll.slots.sort(compareSlots);

        // slots order and reregistration times changed -> apply registration rules again
        const shouldReconcile = poll.type === 2 && isStartDateUpdated;
        if (shouldReconcile) {
          const votes = await tx.vote.findMany({
            where: { pollId },
            select: {
              id: true,
              choices: {
                select: { slotId: true, choice: true, priority: true },
              },
            },
          });
          removeDeletedVotes({
            slots: poll.slots,
            voteIds: votes.map((vote) => vote.id),
          });

          reconcileSlotsArrays({
            slots: poll.slots,
            choicesByVoteId: getChoicesByVoteId(votes),
            timeBeforeAllowedPassed: checkTimeBeforeAllow({
              timeBeforeAllowedType: poll.timeBeforeAllowedType,
              msBeforeAllowed: poll.msBeforeAllowed,
              slots: poll.slots,
            }),
          });
        }

        const updatedSlots = shouldReconcile
          ? poll.slots.filter((slot) => {
              const initialSlot = initialPoll.find((s) => s.id === slot.id)!;
              return (
                JSON.stringify(getSlotArrays(slot)) !==
                JSON.stringify(getSlotArrays(initialSlot))
              );
            })
          : [];

        // a cron schedule already due does nothing more than the reconcile above
        const cronSchedules = shouldReconcile
          ? getCronSchedulesData({
              pollId,
              timeBeforeAllowedType: poll.timeBeforeAllowedType,
              msBeforeAllowed: poll.msBeforeAllowed,
              slots: poll.slots,
            })
          : [];

        await tx.slot.update({
          where: { id: slotId },
          data: { startDate, endDate },
        });
        for (const slot of updatedSlots) {
          await tx.slot.update({
            where: { id: slot.id },
            data: getSlotArrays(slot),
          });
        }
        if (shouldReconcile) {
          await tx.cronSchedule.deleteMany({ where: { pollId } });
          await tx.cronSchedule.createMany({ data: cronSchedules });
        }

        return { poll, initialPoll, oldSlot, shouldReconcile };
      });
      // dates not changed
      if (!update) return { success: true };
      const { poll, initialPoll, oldSlot, shouldReconcile } = update;

      // people who got registered
      if (shouldReconcile) {
        sendNotifications({
          poll,
          pollId,
          voteId: "",
          initialPoll,
          newPoll: poll,
        }).catch((err) => console.log(err));
      }

      sendSlotUpdateNotifications({
        pollId,
        slotId,
        pollTitle: poll.title,
        oldSlot,
        newSlot: { startDate, endDate },
        exceptEndpoint,
      }).catch((err) => console.log(err));

      return { success: true };
    },
  );
