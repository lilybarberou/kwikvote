import { env } from "@/lib/env";
import { sameDay } from "@/lib/utils";
import { prisma } from "@/prisma/db";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { fr } from "date-fns/locale/fr";
import "server-only";
import webpush from "web-push";

import type { PollWithSlots } from "./api/vote/mutation";

// push notifications sent by the server actions: they must not live in a
// "use server" file, where every export becomes a public server action

webpush.setVapidDetails(
  "mailto:" + env.NEXT_PUBLIC_VAPID_EMAIL,
  env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  env.VAPID_PRIVATE_KEY,
);

export const sendNotifications = async ({
  pollId,
  poll,
  voteId,
  newPoll,
  initialPoll,
}: {
  pollId: string;
  poll: PollWithSlots;
  voteId: string;
  newPoll: PollWithSlots;
  initialPoll: PollWithSlots["slots"];
}) => {
  // get new people registered to send notifications
  const votesNewlyRegistered = newPoll.slots.reduce(
    (obj, slot) => {
      obj.votesBySlot[slot.id] = [];

      const oldRegistered = initialPoll.find(
        (initialSlot) => initialSlot.id === slot.id,
      )!.registered;

      // get id addded in registered
      const newRegistered = slot.registered.filter(
        (id) => !oldRegistered.includes(id),
      );

      // push ids which are not in array yet
      newRegistered.forEach((id) => {
        if (!obj.votes.includes(id) && id !== voteId) {
          obj.votes.push(id);
          obj.votesBySlot[slot.id].push(id);
        }
      });

      return obj;
    },
    { votesBySlot: {}, votes: [] } as {
      votesBySlot: { [slotId: string]: string[] };
      votes: string[];
    },
  );

  // get subs from all the votes
  const votesWithSub = await prisma.vote.findMany({
    where: {
      id: { in: votesNewlyRegistered.votes },
    },
    select: {
      id: true,
      subscriptions: {
        select: {
          auth: true,
          endpoint: true,
          p256dh: true,
        },
      },
    },
  });

  Object.entries(votesNewlyRegistered.votesBySlot).forEach(
    ([slotId, votes]) => {
      const slot = poll.slots.find((slot) => slot.id === slotId)!;
      const frSlotDate = toZonedTime(slot.startDate, "Europe/Paris");
      const formattedDate = format(frSlotDate, "eeee d", { locale: fr });
      const formattedTime = format(frSlotDate, "HH:mm", { locale: fr });

      const payload = JSON.stringify({
        title: "Vous êtes inscrit !",
        body: `Bonne nouvelle, vous avez intégré les inscrits du ${formattedDate} à ${formattedTime} !`,
        link: `${env.DOMAIN}/poll/${pollId}`,
      });

      votes.forEach((vote) => {
        const voteSubs = votesWithSub.find(
          (voteWithSub) => voteWithSub.id === vote,
        )?.subscriptions;
        if (!voteSubs) return;

        voteSubs.forEach((sub) => {
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
      });
    },
  );
};

export const sendSlotUpdateNotifications = async ({
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
