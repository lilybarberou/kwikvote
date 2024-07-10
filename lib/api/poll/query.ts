"use server";

import { action } from "@/lib/safe-action";
import { prisma } from "@/prisma/db";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export const getPollsByEmail = action
  .schema(z.string().email())
  .action(async ({ parsedInput: email }) => {
    const poll = await prisma.poll.findMany({
      where: { email },
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return poll;
  });

export const getPollById = action
  .schema(
    z.object({
      pollId: z.string(),
    }),
  )
  .action(async ({ parsedInput: { pollId } }) => {
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: pollInclude,
    });

    return poll;
  });

const pollInclude = Prisma.validator<Prisma.PollInclude>()({
  comments: true,
  slots: {
    select: {
      id: true,
      startDate: true,
      endDate: true,
      maxParticipants: true,
      registered: true,
      waitingList: true,
      waitingListReregistered: true,
      notComing: true,
    },
    orderBy: { startDate: "asc" },
  },
  votes: {
    select: {
      id: true,
      name: true,
      subscriptions: { select: { endpoint: true } },
      choices: {
        select: { id: true, choice: true, slotId: true },
        orderBy: {
          slot: { startDate: "asc" },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  },
});

export type CompletePoll = Prisma.PollGetPayload<{
  include: typeof pollInclude;
}>;
export type GetPollById = CompletePoll | undefined;
export type PollSlot = CompletePoll["slots"][0];
export type PollVote = CompletePoll["votes"][0];
export type PollVoteChoice = PollVote["choices"][0];
