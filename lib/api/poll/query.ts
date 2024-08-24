"use server";

import { action, adminAction, pollPwAction } from "@/lib/safe-action";
import { prisma } from "@/prisma/db";
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
      select: {
        id: true,
        createdAt: true,
        type: true,
        title: true,
        description: true,
        password: true,
        timeBeforeAllowedType: true,
        msBeforeAllowed: true,
        comments: true,
        slots: {
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
      },
    });
    if (!poll) throw new Error("Poll not found");

    const { password, ...rest } = poll;

    return { ...rest, hasPassword: !!password };
  });

export const isPollPasswordValid = pollPwAction.action(async () => {
  return true;
});

export const getPolls = adminAction
  .schema(async (s) =>
    s.merge(
      z.object({
        limit: z.number().optional(),
        offset: z.number().optional(),
        query: z.string().optional(),
      }),
    ),
  )
  .action(async ({ parsedInput: { offset, limit, query: _query } }) => {
    const query = _query?.toLowerCase();

    return await prisma.poll.findMany({
      skip: offset,
      take: limit,
      where: {
        OR: [
          { email: { contains: query } },
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
  });

export type GetPollById = GetDataFromAction<typeof getPollById>;
