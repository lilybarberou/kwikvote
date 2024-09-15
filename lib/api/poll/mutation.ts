"use server";

import { action, pollPwAction } from "@/lib/safe-action";
import {
  CreateSlotSchema,
  createPollSchema,
  updatePollSchema,
} from "@/lib/schema/poll-schema";
import { sendDiscordMessage } from "@/lib/utils.server";
import { prisma } from "@/prisma/db";
import { CronSchedule, VoteChoice } from "@prisma/client";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export const createPoll = action
  .schema(createPollSchema)
  .action(async ({ parsedInput: { initialVotes, ...data } }) => {
    const poll = await prisma.poll.create({
      include: { slots: true, votes: true },
      data: {
        ...data,
        slots: {
          create: data.slots.map((slot: CreateSlotSchema) => slot),
        },
        votes: {
          createMany: {
            data: initialVotes.map((vote) => ({
              name: vote.name,
              hasPriority: true,
            })),
          },
        },
      },
    });

    if (initialVotes && !!initialVotes.length) {
      const slotsIds = poll.slots.map((slot) => slot.id);

      // add votes in slots registered arrays
      await prisma.slot.updateMany({
        where: { id: { in: slotsIds } },
        data: {
          registered: {
            set: poll.votes.map((vote) => vote.id),
          },
        },
      });

      // fill initial votes with "yes" choices
      await prisma.voteChoice.createMany({
        data: poll.votes.flatMap((vote) => {
          return slotsIds.map(
            (slotId) =>
              ({
                slotId,
                voteId: vote.id,
                choice: 1,
              }) as VoteChoice,
          );
        }),
      });
    }

    // calculate all cron schedule times
    if (poll.type === 2) {
      const cronScheduleTimes = poll.slots
        .sort(
          (a, b) =>
            new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
        )
        .reduce((arr, curr, index) => {
          // can't be reregistered on first slot
          if (index === 0) return arr;

          // if slot's startDate is before now, don't create cron schedule
          if (new Date(curr.startDate).getTime() < Date.now()) return arr;

          const currentObj = {
            pollId: poll.id,
            slotId: curr.id,
          } as CronSchedule;

          // day before at 5pm
          if (poll.timeBeforeAllowedType == 1) {
            // gen date at 5PM france time
            const cronDateFr = toZonedTime(curr.startDate, "Europe/Paris");
            cronDateFr.setDate(cronDateFr.getDate() - 1);
            cronDateFr.setHours(17, 0, 0, 0);

            const cronDateUtc = fromZonedTime(cronDateFr, "Europe/Paris");
            currentObj.schedule = cronDateUtc;
          }
          // specific hours number before startDate
          else {
            const timeBeforeDate = new Date(
              new Date(curr.startDate).getTime() - poll.msBeforeAllowed,
            );
            currentObj.schedule = timeBeforeDate;
          }

          arr.push(currentObj);
          return arr;
        }, [] as CronSchedule[]);

      await prisma.cronSchedule.createMany({
        data: cronScheduleTimes,
      });
    }

    // send discord notification
    sendDiscordMessage({
      title: `Nouveau sondage "${poll.title}"`,
      description: data.email,
      fields: [
        { name: "Lien", value: `${process.env.DOMAIN}/poll/${poll.id}` },
      ],
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
