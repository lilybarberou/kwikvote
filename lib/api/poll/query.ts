"use server";

import { action } from "@/lib/safe-action";
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

export const isPollPasswordValid = action
  .schema(z.object({ pollId: z.string(), password: z.string() }))
  .action(async ({ parsedInput: { pollId, password } }) => {
    if (password === process.env.ADMIN_PASSWORD) return true;

    const poll = await prisma.poll.findFirst({
      where: { id: pollId },
      select: { password: true },
    });
    if (!poll) throw new Error("Poll not found");

    return poll.password === password;
  });

export type GetPollById = GetDataFromAction<typeof getPollById>;
