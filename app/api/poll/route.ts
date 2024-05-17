import { prisma } from '@/prisma/db';
import { CronSchedule } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fromZonedTime } from 'date-fns-tz';

export async function GET(_: NextRequest) {
  const polls = await prisma.poll.findMany();
  return NextResponse.json(polls);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = CreatePollSchema.parse(body);

    const poll = await prisma.poll.create({
      data: {
        type: data.type,
        title: data.title,
        description: data.description,
        email: data.email,
        timeBeforeAllowedType: data.timeBeforeAllowedType,
        msBeforeAllowed: data.msBeforeAllowed,
        slots: {
          create: data.slots.map((slot: z.infer<typeof CreateSlotSchema>) => slot),
        },
      },
    });

    // calculate all cron schedule times
    if (poll.type === 2) {
      const cronScheduleTimes = data.slots
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
        .reduce((arr, curr, index) => {
          // can't be reregistered on first slot
          if (index === 0) return arr;

          // if slot's startDate is before now, don't create cron schedule
          if (new Date(curr.startDate).getTime() < Date.now()) return arr;

          const currentObj = { pollId: poll.id } as CronSchedule;

          // day before at 5pm
          if (poll.timeBeforeAllowedType == 1) {
            const cronDate = new Date(curr.startDate);
            cronDate.setDate(cronDate.getDate() - 1);
            cronDate.setHours(17, 0, 0, 0);
            const utcCronDate = fromZonedTime(cronDate, 'Europe/Paris');
            currentObj.schedule = utcCronDate;
          }
          // specific hours number before startDate
          else {
            const timeBeforeDate = new Date(new Date(curr.startDate).getTime() - poll.msBeforeAllowed);
            currentObj.schedule = timeBeforeDate;
          }

          arr.push(currentObj);
          return arr;
        }, [] as CronSchedule[]);

      await prisma.cronSchedule.createMany({
        data: cronScheduleTimes,
      });
    }

    return NextResponse.json(poll);
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ message: 'Données incorrectes' }, { status: 400 });
    return NextResponse.json({ message: 'Erreur lors de la création du sondage' }, { status: 500 });
  }
}

const CreateSlotSchema = z.object({
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
  maxParticipants: z.number().int().positive(),
});

const CreatePollSchema = z.object({
  type: z.number().int().positive().min(1).max(2),
  title: z.string(),
  description: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  timeBeforeAllowedType: z.number(),
  msBeforeAllowed: z.number(),
  slots: z.array(CreateSlotSchema),
});
