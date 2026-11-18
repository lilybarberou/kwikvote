"use server";

import { env } from "@/lib/env";
import {
  LimitChecks,
  getClientIp,
  getLimitMessage,
  hitAll,
  limiters,
} from "@/lib/rate-limits.server";
import { sendPush } from "@/lib/push.server";
import { ActionError, action } from "@/lib/safe-action";
import { createCommentSchema } from "@/lib/schema/comment-schema";
import { prisma } from "@/prisma/db";

export const createComment = action
  .schema(createCommentSchema)
  .action(async ({ parsedInput: data }) => {
    // each comment notifies every subscriber of the poll
    const ip = await getClientIp();
    const { pollId } = data.comment;
    const limits: LimitChecks = [
      [limiters.commentsByIpAndPoll, `${ip} ${pollId}`],
      [limiters.commentsByIp, ip],
      [limiters.commentsByPoll, pollId],
    ];
    const limited = getLimitMessage(limits);
    if (limited) throw new ActionError(limited);
    hitAll(limits);

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
      link: `${env.DOMAIN}/poll/${comment.pollId}?tab=comments`,
    });

    // OBJECT TO GET UNIQUE SUBS
    const subscriptions: Subscriptions = {};
    votes.forEach((vote) => {
      vote.subscriptions.forEach((sub) => {
        subscriptions[sub.endpoint] = sub;
      });
    });

    // REMOVE ENDPOINT FROM MESSAGE'S AUTHOR
    if (data.exceptEndpoint) delete subscriptions[data.exceptEndpoint];

    // SEND NOTIFICATION TO ALL SUBS
    Object.values(subscriptions).forEach((sub) => sendPush(sub, payload));

    return comment;
  });

type Subscriptions = {
  [endpoint: string]: { endpoint: string; auth: string; p256dh: string };
};
