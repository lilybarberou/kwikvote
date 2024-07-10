"use server";

import { action } from "@/lib/safe-action";
import { createCommentSchema } from "@/lib/schema/comment-schema";
import { prisma } from "@/prisma/db";
import webpush from "web-push";

webpush.setVapidDetails(
  "mailto:" + process.env.NEXT_PUBLIC_VAPID_EMAIL,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

export const createComment = action
  .schema(createCommentSchema)
  .action(async ({ parsedInput: data }) => {
    const comment = await prisma.comment.create({ data: data.comment });

    // SEND NOTIFICATION TO ALL POLL SUBS
    const votes = await prisma.vote.findMany({
      where: {
        pollId: comment.pollId,
      },
      select: {
        subscriptions: {
          select: {
            auth: true,
            endpoint: true,
            p256dh: true,
          },
        },
        poll: {
          select: {
            title: true,
          },
        },
      },
    });

    if (!votes.length) return comment;

    const payload = JSON.stringify({
      title: "Nouveau commentaire !",
      body: `Il y a un nouveau commentaire de ${comment.author} sur le sondage ${votes[0].poll.title}`,
      link: `${process.env.DOMAIN}/poll/${comment.pollId}?tab=comments`,
    });

    // OBJECT TO GET UNIQUE SUBS
    const subscriptions: Subscriptions = {};
    votes.forEach((vote) => {
      vote.subscriptions.forEach((sub) => {
        subscriptions[sub.endpoint] = {
          endpoint: sub.endpoint,
          keys: {
            auth: sub.auth,
            p256dh: sub.p256dh,
          },
        };
      });
    });

    // REMOVE ENDPOINT FROM MESSAGE'S AUTHOR
    if (data.exceptEndpoint) delete subscriptions[data.exceptEndpoint];

    // SEND NOTIFICATION TO ALL SUBS
    Object.values(subscriptions).forEach((sub) => {
      webpush
        .sendNotification(sub, payload)
        .then((res) => console.log(res))
        .catch((err) => console.log(err));
    });

    return comment;
  });

type Subscriptions = {
  [endpoint: string]: {
    endpoint: string;
    keys: {
      auth: string;
      p256dh: string;
    };
  };
};
