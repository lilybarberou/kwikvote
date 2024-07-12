"use server";

import { action } from "@/lib/safe-action";
import { checkTimeBeforeAllow } from "@/lib/utils";
import { prisma } from "@/prisma/db";
import { z } from "zod";

import { PollWithSlots, sendNotifications } from "../vote/mutation";

export const deleteSlotById = action
  .schema(z.object({ slotId: z.string() }))
  .action(async ({ parsedInput: { slotId } }) => {
    const deletedSlot = await prisma.slot.delete({ where: { id: slotId } });

    const poll = await prisma.poll.findUnique({
      where: { id: deletedSlot.pollId },
      include: {
        slots: {
          orderBy: {
            startDate: "asc",
          },
        },
      },
    });
    if (!poll) return;

    const initialPoll = JSON.parse(
      JSON.stringify(poll.slots),
    ) as PollWithSlots["slots"];

    // check if someone can be registered
    let voteIdToRegister = "";
    poll.slots.forEach((slot) => {
      if (slot.waitingListReregistered.length > 0) {
        voteIdToRegister = slot.waitingListReregistered[0];
      }
    });

    if (voteIdToRegister) {
      const timeBeforeAllowedPassed = checkTimeBeforeAllow({
        timeBeforeAllowedType: poll.timeBeforeAllowedType,
        msBeforeAllowed: poll.msBeforeAllowed,
        slots: poll.slots,
      });

      const newPoll = await updateSlotsArray({
        poll,
        voteId: voteIdToRegister,
        timeBeforeAllowedPassed: timeBeforeAllowedPassed,
      });

      // update slots in db
      for (const slot of newPoll.slots) {
        await prisma.slot.update({
          where: { id: slot.id },
          data: slot,
        });
      }

      sendNotifications({
        poll: newPoll,
        pollId: poll.id,
        voteId: voteIdToRegister,
        initialPoll,
        newPoll,
      });
    }
  });

const updateSlotsArray = async ({
  poll,
  voteId,
  timeBeforeAllowedPassed,
}: {
  poll: PollWithSlots;
  voteId: string;
  timeBeforeAllowedPassed: Record<string, boolean>;
}) => {
  console.log(voteId);
  let isRegisteredOnce = false;

  const currentVoteData = await prisma.vote.findUnique({
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
