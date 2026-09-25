"use server";

import { env } from "@/lib/env";
import {
  compareSlots,
  getCronSchedulesData,
  getSlotArrays,
  reconcileSlotsArrays,
  slotsOrderBy,
} from "@/lib/registration";
import { pollPwAction } from "@/lib/safe-action";
import { updateSlotSchema } from "@/lib/schema/slot-schema";
import { checkTimeBeforeAllow, sameDay } from "@/lib/utils";
import { prisma } from "@/prisma/db";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { fr } from "date-fns/locale/fr";
import webpush from "web-push";
import { z } from "zod";

import { PollWithSlots, sendNotifications } from "../vote/mutation";

webpush.setVapidDetails(
  "mailto:" + env.NEXT_PUBLIC_VAPID_EMAIL,
  env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  env.VAPID_PRIVATE_KEY,
);

export const deleteSlotById = pollPwAction
  .schema(async (s) => s.extend({ slotId: z.string() }))
  .action(async ({ parsedInput: { pollId, slotId } }) => {
    // only a slot of the poll whose password was checked
    const { count } = await prisma.slot.deleteMany({
      where: { id: slotId, pollId },
    });
    if (!count) throw new Error("Slot not found");

    const poll = await prisma.poll.findUnique({
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
          data: getSlotArrays(slot),
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
      const poll = await prisma.poll.findUnique({
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
      if (!isStartDateUpdated && !isEndDateUpdated) return { success: true };

      const initialPoll = JSON.parse(
        JSON.stringify(poll.slots),
      ) as PollWithSlots["slots"];

      slot.startDate = startDate;
      slot.endDate = endDate;
      poll.slots.sort(compareSlots);

      // slots order and reregistration times changed -> apply registration rules again
      const shouldReconcile = poll.type === 2 && isStartDateUpdated;
      if (shouldReconcile) {
        const votes = await prisma.vote.findMany({
          where: { pollId },
          select: {
            id: true,
            choices: { select: { slotId: true, choice: true } },
          },
        });
        const choicesByVoteId = votes.reduce(
          (obj, vote) => {
            obj[vote.id] = Object.fromEntries(
              vote.choices.map((choice) => [choice.slotId, choice.choice]),
            );
            return obj;
          },
          {} as Record<string, Record<string, number>>,
        );

        reconcileSlotsArrays({
          slots: poll.slots,
          choicesByVoteId,
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

      await prisma.$transaction([
        prisma.slot.update({
          where: { id: slotId },
          data: { startDate, endDate },
        }),
        ...updatedSlots.map((slot) =>
          prisma.slot.update({
            where: { id: slot.id },
            data: getSlotArrays(slot),
          }),
        ),
        ...(shouldReconcile
          ? [
              prisma.cronSchedule.deleteMany({ where: { pollId } }),
              prisma.cronSchedule.createMany({ data: cronSchedules }),
            ]
          : []),
      ]);

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

const sendSlotUpdateNotifications = async ({
  pollId,
  slotId,
  pollTitle,
  oldSlot,
  newSlot,
  exceptEndpoint,
}: {
  pollId: string;
  slotId: string;
  pollTitle: string;
  oldSlot: { startDate: Date; endDate: Date };
  newSlot: { startDate: Date; endDate: Date };
  exceptEndpoint?: string;
}) => {
  const subscriptions = await prisma.subscription.findMany({
    where: {
      votes: { some: { pollId } },
      endpoint: exceptEndpoint ? { not: exceptEndpoint } : undefined,
    },
    select: {
      auth: true,
      endpoint: true,
      p256dh: true,
    },
  });
  if (!subscriptions.length) return;

  const oldStartFr = toZonedTime(oldSlot.startDate, "Europe/Paris");
  const newStartFr = toZonedTime(newSlot.startDate, "Europe/Paris");
  const newEndFr = toZonedTime(newSlot.endDate, "Europe/Paris");
  const formatDate = (date: Date) =>
    format(date, "eeee d MMMM", { locale: fr });
  const formatTime = (date: Date) => format(date, "HH:mm", { locale: fr });

  const newSlotLabel = sameDay(newStartFr, newEndFr)
    ? `${formatDate(newStartFr)} de ${formatTime(newStartFr)} à ${formatTime(newEndFr)}`
    : `du ${formatDate(newStartFr)} à ${formatTime(newStartFr)} au ${formatDate(newEndFr)} à ${formatTime(newEndFr)}`;

  const payload = JSON.stringify({
    title: "Changement d'horaire",
    body: `Le créneau du ${formatDate(oldStartFr)} à ${formatTime(oldStartFr)} du sondage ${pollTitle} a changé : ${newSlotLabel}.`,
    // the link is used as notification tag, one per slot so they don't replace each other
    link: `${env.DOMAIN}/poll/${pollId}?tab=votes&slot=${slotId}`,
  });

  subscriptions.forEach((sub) => {
    webpush
      .sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            auth: sub.auth,
            p256dh: sub.p256dh,
          },
        },
        payload,
      )
      .then((res) => console.log("notif envoyée: ", res.statusCode))
      .catch((err) => console.log(err));
  });
};

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
