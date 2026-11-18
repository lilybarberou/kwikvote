import { prisma } from "@/prisma/db";
import { v4 } from "uuid";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";

import { createVote } from "../vote/mutation";
import { deleteSlotById, updateSlotById } from "./mutation";

// no push notification: only record who would be notified
const calls = vi.hoisted(() => ({
  registered: [] as { slotId: string; voteId: string }[],
  slotUpdates: [] as Record<string, unknown>[],
}));
vi.mock("@/lib/notifications.server", () => ({
  sendNotifications: async ({
    voteId,
    newPoll,
    initialPoll,
  }: {
    voteId: string;
    newPoll: { slots: { id: string; registered: string[] }[] };
    initialPoll: { id: string; registered: string[] }[];
  }) => {
    newPoll.slots.forEach((slot) => {
      const before = initialPoll.find((s) => s.id === slot.id)!.registered;
      slot.registered
        .filter((id) => !before.includes(id) && id !== voteId)
        .forEach((id) =>
          calls.registered.push({ slotId: slot.id, voteId: id }),
        );
    });
  },
  sendSlotUpdateNotifications: async (args: Record<string, unknown>) => {
    calls.slotUpdates.push(args);
  },
}));

const errors = vi.spyOn(console, "error").mockImplementation(() => {});

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const TITLE = "integration test updateSlotById";
const PASSWORD = "slot-password";

// slots one day apart, a year from now: the reregistration times are far away
const createPoll = async (type: number, maxParticipants: number[]) => {
  const start = Date.now() + 365 * DAY;
  return prisma.poll.create({
    data: {
      type,
      title: TITLE,
      password: PASSWORD,
      timeBeforeAllowedType: 2,
      msBeforeAllowed: 3 * HOUR,
      slots: {
        create: maxParticipants.map((max, index) => ({
          startDate: new Date(start + index * DAY),
          endDate: new Date(start + index * DAY + 2 * HOUR),
          maxParticipants: max,
        })),
      },
    },
    include: { slots: { orderBy: [{ startDate: "asc" }, { id: "asc" }] } },
  });
};
type Poll = Awaited<ReturnType<typeof createPoll>>;

const vote = async (poll: Poll, choices: number[]) => {
  const id = v4();
  const res = await createVote({
    id,
    name: id,
    pollId: poll.id,
    choices: poll.slots.map((slot, index) => ({
      id: v4(),
      slotId: slot.id,
      choice: choices[index],
    })),
  });
  expect(res?.serverError).toBeUndefined();
  return id;
};

const slotOf = (id: string) => prisma.slot.findUniqueOrThrow({ where: { id } });

beforeEach(() => {
  calls.registered.length = 0;
  calls.slotUpdates.length = 0;
});

afterAll(async () => {
  errors.mockRestore();
  await prisma.poll.deleteMany({ where: { title: TITLE } });
  await prisma.$disconnect();
});

describe("updateSlotById (local database)", () => {
  test("moving a slot first: the spots are kept, the waiting lists and the cron schedules follow the new order", async () => {
    const poll = await createPoll(2, [1, 1]);
    const [fri, sat] = poll.slots;
    const A = await vote(poll, [1, 1]);
    const B = await vote(poll, [1, 1]);
    // A registered friday, B saturday
    expect((await slotOf(fri.id)).registered).toEqual([A]);
    expect((await slotOf(sat.id)).registered).toEqual([B]);

    // saturday becomes the day before friday
    const startDate = new Date(fri.startDate.getTime() - DAY);
    const endDate = new Date(startDate.getTime() + 2 * HOUR);
    const res = await updateSlotById({
      pollId: poll.id,
      password: PASSWORD,
      slotId: sat.id,
      startDate,
      endDate,
      exceptEndpoint: "https://push.invalid/author",
    });
    expect(res?.data).toEqual({ success: true });

    const moved = await slotOf(sat.id);
    expect(moved.startDate).toEqual(startDate);
    expect(moved.endDate).toEqual(endDate);
    // everyone keeps their spot, the waiting lists follow the new order:
    // A now waits on the new first slot, B is reregistered on friday
    expect(moved.registered).toEqual([B]);
    expect(moved.waitingList).toEqual([A]);
    expect(moved.waitingListReregistered).toEqual([]);
    const friday = await slotOf(fri.id);
    expect(friday.registered).toEqual([A]);
    expect(friday.waitingList).toEqual([]);
    expect(friday.waitingListReregistered).toEqual([B]);
    expect(calls.registered).toEqual([]);

    const schedules = await prisma.cronSchedule.findMany({
      where: { pollId: poll.id },
      orderBy: { schedule: "asc" },
    });
    expect(schedules.map((s) => [s.slotId, s.schedule.getTime()])).toEqual([
      [sat.id, startDate.getTime() - 3 * HOUR],
      [fri.id, fri.startDate.getTime() - 3 * HOUR],
    ]);

    expect(calls.slotUpdates).toEqual([
      {
        pollId: poll.id,
        slotId: sat.id,
        pollTitle: TITLE,
        oldSlot: { startDate: sat.startDate, endDate: sat.endDate },
        newSlot: { startDate, endDate },
        exceptEndpoint: "https://push.invalid/author",
      },
    ]);
  });

  test("only the end date: the registrations and the cron schedules are kept", async () => {
    const poll = await createPoll(2, [1, 1]);
    const [fri] = poll.slots;
    const A = await vote(poll, [1, 1]);
    const before = await prisma.slot.findMany({
      where: { pollId: poll.id },
      orderBy: { id: "asc" },
    });
    const endDate = new Date(fri.endDate.getTime() + HOUR);

    await updateSlotById({
      pollId: poll.id,
      password: PASSWORD,
      slotId: fri.id,
      startDate: fri.startDate,
      endDate,
    });

    expect((await slotOf(fri.id)).endDate).toEqual(endDate);
    expect((await slotOf(fri.id)).registered).toEqual([A]);
    const after = await prisma.slot.findMany({
      where: { pollId: poll.id },
      orderBy: { id: "asc" },
    });
    expect(after.map(({ endDate: _, ...slot }) => slot)).toEqual(
      before.map(({ endDate: _, ...slot }) => slot),
    );
    expect(calls.registered).toEqual([]);
    expect(calls.slotUpdates).toHaveLength(1);
  });

  test("same dates: nothing is written nor sent", async () => {
    const poll = await createPoll(1, [0]);
    const [slot] = poll.slots;
    const res = await updateSlotById({
      pollId: poll.id,
      password: PASSWORD,
      slotId: slot.id,
      startDate: slot.startDate,
      endDate: slot.endDate,
    });
    expect(res?.data).toEqual({ success: true });
    expect(calls.slotUpdates).toEqual([]);
  });

  test("the end must be after the start", async () => {
    const poll = await createPoll(1, [0]);
    const [slot] = poll.slots;
    for (const endDate of [
      slot.startDate,
      new Date(slot.startDate.getTime() - 1),
    ]) {
      const res = await updateSlotById({
        pollId: poll.id,
        password: PASSWORD,
        slotId: slot.id,
        startDate: slot.startDate,
        endDate,
      });
      expect(res?.validationErrors).toBeDefined();
    }
    expect((await slotOf(slot.id)).endDate).toEqual(slot.endDate);
  });

  test("refused with a wrong password, or on a slot of another poll", async () => {
    const poll = await createPoll(1, [0]);
    const other = await createPoll(1, [0]);
    const startDate = new Date(Date.now() + 500 * DAY);
    const endDate = new Date(startDate.getTime() + HOUR);

    const wrong = await updateSlotById({
      pollId: poll.id,
      password: "wrong",
      slotId: poll.slots[0].id,
      startDate,
      endDate,
    });
    expect(wrong?.serverError).toBe("Mot de passe incorrect");

    // the password of `poll` doesn't give access to the slots of `other`
    const otherSlot = await updateSlotById({
      pollId: poll.id,
      password: PASSWORD,
      slotId: other.slots[0].id,
      startDate,
      endDate,
    });
    expect(otherSlot?.serverError).toBe("Ce créneau n'existe plus");

    expect((await slotOf(poll.slots[0].id)).startDate).toEqual(
      poll.slots[0].startDate,
    );
    expect((await slotOf(other.slots[0].id)).startDate).toEqual(
      other.slots[0].startDate,
    );
    expect(calls.slotUpdates).toEqual([]);
  });
});

describe("deleteSlotById permissions (local database)", () => {
  test("refused with a wrong password, or on a slot of another poll", async () => {
    const poll = await createPoll(1, [0, 0]);
    const other = await createPoll(1, [0, 0]);

    const wrong = await deleteSlotById({
      pollId: poll.id,
      password: "wrong",
      slotId: poll.slots[0].id,
    });
    expect(wrong?.serverError).toBe("Mot de passe incorrect");

    const otherSlot = await deleteSlotById({
      pollId: poll.id,
      password: PASSWORD,
      slotId: other.slots[0].id,
    });
    expect(otherSlot?.serverError).toBe("Ce créneau a déjà été supprimé");

    expect(
      await prisma.slot.count({
        where: { pollId: { in: [poll.id, other.id] } },
      }),
    ).toBe(4);
  });

  test("a free poll: the slot and its choices are deleted, the other slots kept", async () => {
    const poll = await createPoll(1, [0, 0]);
    const A = await vote(poll, [1, 3]);

    const res = await deleteSlotById({
      pollId: poll.id,
      password: PASSWORD,
      slotId: poll.slots[1].id,
    });
    expect(res?.data).toEqual({ success: true });

    expect(
      (await prisma.voteChoice.findMany({ where: { voteId: A } })).map(
        (c) => c.slotId,
      ),
    ).toEqual([poll.slots[0].id]);
    expect(await prisma.slot.count({ where: { pollId: poll.id } })).toBe(1);
    expect(calls.registered).toEqual([]);
  });
});
