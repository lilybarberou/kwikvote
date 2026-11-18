"use server";

import { env } from "@/lib/env";
import { hashPollPassword } from "@/lib/poll-password.mjs";
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
    // never stored in clear (lib/poll-password.mjs)
    const password = data.password ? await hashPollPassword(data.password) : "";

    // a registration poll without its cron schedules would never move the
    // reregistered people: both are created or none
    const poll = await prisma.$transaction(async (tx) => {
      const poll = await tx.poll.create({
        include: { slots: true },
        data: {
          ...data,
          password,
          slots: {
            create: data.slots.map((slot: CreateSlotSchema) => slot),
          },
        },
      });

      // calculate all cron schedule times
      if (poll.type === 2) {
        await tx.cronSchedule.createMany({
          data: getCronSchedulesData({
            pollId: poll.id,
            timeBeforeAllowedType: poll.timeBeforeAllowedType,
            msBeforeAllowed: poll.msBeforeAllowed,
            slots: poll.slots,
          }),
        });
      }

      return poll;
    });

    // send discord notification, its failure doesn't concern the author
    sendDiscordMessage({
      title: `Nouveau sondage "${poll.title}"`,
      description: data.email,
      fields: [{ name: "Lien", value: `${env.DOMAIN}/poll/${poll.id}` }],
    }).catch((err) => console.log(err));

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
  .action(async ({ parsedInput: { pollId, title, description } }) => {
    // not the password: it's only used to authenticate (and can be the admin one)
    await prisma.poll.update({
      where: { id: pollId },
      data: { title, description },
    });

    return { success: true };
  });
