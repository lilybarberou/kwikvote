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

    // create start and end date time
    data.slots = data.slots.map((slot) => {
      const startDate = new Date(slot.startDate);
      const endDate = new Date(slot.endDate);
      const startTime = slot.startTime.split(':');
      const endTime = slot.endTime.split(':');

      // bc of separated date/hour, we need to set hours manually so its fr hours
      // we need to parse this date to utc
      startDate.setHours(+startTime[0], +startTime[1], 0, 0);
      const utcStartDate = fromZonedTime(startDate, 'Europe/Paris');
      endDate.setHours(+endTime[0], +endTime[1], 0, 0);
      const utcEndDate = fromZonedTime(endDate, 'Europe/Paris');

      return { ...slot, startDate: utcStartDate, endDate: utcEndDate };
    });

    const poll = await prisma.poll.create({
      data: {
        type: data.type,
        title: data.title,
        description: data.description,
        email: data.email,
        timeBeforeAllowedType: data.timeBeforeAllowedType,
        msBeforeAllowed: data.msBeforeAllowed,
        slots: {
          create: data.slots.map(({ startTime, endTime, ...slot }: z.infer<typeof CreateSlotSchema>) => slot),
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

          // if startdate + starttime is before now, don't create cron schedule
          const slotDate = new Date(curr.startDate);
          const hours = curr.startTime.split(':')[0];
          const minutes = curr.startTime.split(':')[1];
          const slotDateTime = new Date(slotDate.setHours(+hours, +minutes, 0, 0));
          if (slotDateTime.getTime() < Date.now()) return arr;

          const currentObj = { pollId: poll.id } as CronSchedule;

          // day before at 5pm
          if (poll.timeBeforeAllowedType == 1) {
            const slotDate = new Date(curr.startDate);
            slotDate.setDate(slotDate.getDate() - 1);
            slotDate.setHours(17, 0, 0, 0);
            currentObj.schedule = slotDate;
          }
          // specific hours number before startDate
          else {
            const timeBeforeDate = new Date(slotDateTime.getTime() - poll.msBeforeAllowed);
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
  startTime: z.string(),
  endDate: z.string().or(z.date()),
  endTime: z.string(),
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
