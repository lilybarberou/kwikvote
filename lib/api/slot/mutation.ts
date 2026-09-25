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
import { pollPwAction } from "@/lib/safe-action";
import { updateSlotSchema } from "@/lib/schema/slot-schema";
import { checkTimeBeforeAllow } from "@/lib/utils";
import { withPollLock } from "@/prisma/db";
import { Prisma } from "@prisma/client";
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
      if (!count) throw new Error("Slot not found");

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

      // check if someone can be registered
      let voteIdToRegister = "";
      poll.slots.forEach((slot) => {
        if (slot.waitingListReregistered.length > 0) {
          voteIdToRegister = slot.waitingListReregistered[0];
        }
      });

      const newPoll = voteIdToRegister
        ? await updateSlotsArray({
            tx,
            poll,
            voteId: voteIdToRegister,
            timeBeforeAllowedPassed,
          })
        : poll;

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

      // people registered by the repair or the recursion
      return {
        poll: newPoll,
        pollId: poll.id,
        voteId: voteIdToRegister,
        initialPoll,
        newPoll,
      };
    });

    if (registration) {
      sendNotifications(registration).catch((err) => console.log(err));
    }
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
        if (!poll || !slot) throw new Error("Slot not found");

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
              choices: { select: { slotId: true, choice: true } },
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

const updateSlotsArray = async ({
  tx,
  poll,
  voteId,
  timeBeforeAllowedPassed,
}: {
  tx: Prisma.TransactionClient;
  poll: PollWithSlots;
  voteId: string;
  timeBeforeAllowedPassed: Record<string, boolean>;
}) => {
  console.log(voteId);
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
    const currentVoteChoice = currentVoteData?.choices.find(
      (choice) => choice.slotId === slot.id,
    );
    const isChoiceYes = currentVoteChoice?.choice === 1;

    const isAllowedToRegister = () => !isRegisteredOnce || timePassed;
    const isFull = () => slot.registered.length >= slot.maxParticipants;

    if (isChoiceYes) {
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
  poll.slots.forEach((slot, index) => {
    const timePassed = timeBeforeAllowedPassed[slot.id];

    console.log("-------------------");
    console.log("index: ", index);
    const { registered, waitingList, waitingListReregistered, notComing } =
      slot;
    console.log({
      registered,
      waitingList,
      waitingListReregistered,
      notComing,
    });

    const allWaitingReregisteredAreRegisteredOnce =
      slot.waitingListReregistered.every(
        (id) =>
          poll.slots.some((s) => s.registered.includes(id)) ||
          poll.slots.some((s) => s.waitingList.includes(id)),
      );

    console.log(
      "all registered once: ",
      allWaitingReregisteredAreRegisteredOnce,
    );
    console.log("timePassed: ", timePassed);

    if (timePassed || index === 0 || !allWaitingReregisteredAreRegisteredOnce) {
      const isWaitingListReregisteredNotEmpty =
        slot.waitingListReregistered.length > 0;

      if (isWaitingListReregisteredNotEmpty) {
        console.log("reste des réinscrits");
        // on prend un réinscrit qui n'est pas déjà inscrit sur un autre créneau
        const reregisteredNotRegisteredOnce = slot.waitingListReregistered.find(
          (id) =>
            !poll.slots.some((s) => s.registered.includes(id)) &&
            !poll.slots.some((s) => s.waitingList.includes(id)),
        );
        if (reregisteredNotRegisteredOnce) {
          voteIdToRegister = reregisteredNotRegisteredOnce;
          console.log("voteIdToRegister: ", voteIdToRegister);
        }
      }
    }
  });

  if (voteIdToRegister) {
    poll = await updateSlotsArray({
      tx,
      poll,
      voteId: voteIdToRegister,
      timeBeforeAllowedPassed,
    });
  }
  // move wlr to wl if time passed
  else {
    poll.slots.forEach((slot) => {
      const timePassed = timeBeforeAllowedPassed[slot.id];

      if (timePassed) {
        slot.waitingList = [
          ...slot.waitingList,
          ...slot.waitingListReregistered,
        ];
        slot.waitingListReregistered = [];
      }
    });
  }

  return poll;
};
