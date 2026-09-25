"use server";

import { env } from "@/lib/env";
import { getCronSchedulesData } from "@/lib/registration";
import { action, pollPwAction } from "@/lib/safe-action";
import {
  CreateSlotSchema,
  createPollSchema,
  updatePollSchema,
} from "@/lib/schema/poll-schema";
import { sendDiscordMessage } from "@/lib/utils.server";
import { prisma } from "@/prisma/db";

export const createPoll = action
  .schema(createPollSchema)
  .action(async ({ parsedInput: data }) => {
    const poll = await prisma.poll.create({
      include: { slots: true },
      data: {
        ...data,
        slots: {
          create: data.slots.map((slot: CreateSlotSchema) => slot),
        },
      },
    });

    // calculate all cron schedule times
    if (poll.type === 2) {
      await prisma.cronSchedule.createMany({
        data: getCronSchedulesData({
          pollId: poll.id,
          timeBeforeAllowedType: poll.timeBeforeAllowedType,
          msBeforeAllowed: poll.msBeforeAllowed,
          slots: poll.slots,
        }),
      });
    }

    // send discord notification
    sendDiscordMessage({
      title: `Nouveau sondage "${poll.title}"`,
      description: data.email,
      fields: [{ name: "Lien", value: `${env.DOMAIN}/poll/${poll.id}` }],
    });

    return poll.id;
  });

export const deletePoll = pollPwAction.action(
  async ({ parsedInput: { pollId } }) => {
    await prisma.poll.delete({ where: { id: pollId } });
    return { success: true };
  },
);

export const updatePoll = pollPwAction
  .schema(async (s) => s.merge(updatePollSchema))
  .action(async ({ parsedInput: { pollId, ...data } }) => {
    await prisma.poll.update({
      where: { id: pollId },
      data,
    });
  });
