import { prisma } from "@/prisma/db";
import { v4 } from "uuid";
import { afterAll, describe, expect, test, vi } from "vitest";

import { createVote } from "../vote/mutation";
import { deleteSlotById } from "./mutation";

// no push notification: only record who would be notified
const notified = vi.hoisted(() => [] as { slotId: string; voteId: string }[]);
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
        .forEach((id) => notified.push({ slotId: slot.id, voteId: id }));
    });
  },
  sendSlotUpdateNotifications: async () => {},
}));

const DAY = 24 * 60 * 60 * 1000;
const TITLE = "integration test deleteSlotById";
const PASSWORD = "integration-test-password";

afterAll(async () => {
  await prisma.poll.deleteMany({ where: { title: TITLE } });
  await prisma.$disconnect();
});

describe("deleteSlotById (local database)", () => {
  test("reregistered people waiting on a full slot get the free spots", async () => {
    // friday 1 spot, saturday and sunday 5, reregistration times far away
    const start = Date.now() + 365 * DAY;
    const poll = await prisma.poll.create({
      data: {
        type: 2,
        title: TITLE,
        password: PASSWORD,
        slots: {
          create: [1, 5, 5].map((max, index) => ({
            startDate: new Date(start + index * DAY),
            endDate: new Date(start + index * DAY + 2 * 60 * 60 * 1000),
            maxParticipants: max,
          })),
        },
      },
      include: { slots: { orderBy: [{ startDate: "asc" }, { id: "asc" }] } },
    });
    const [fri, sat, sun] = poll.slots.map((slot) => slot.id);
    const ids = { A: v4(), P: v4(), Q: v4() };

    for (const [name, answers] of [
      ["A", [1, 2, 2]],
      ["P", [1, 1, 1]],
      ["Q", [1, 1, 1]],
    ] as const) {
      const res = await createVote({
        id: ids[name],
        name,
        pollId: poll.id,
        choices: poll.slots.map((slot, index) => ({
          id: v4(),
          slotId: slot.id,
          choice: answers[index],
        })),
      });
      expect(res?.serverError).toBeUndefined();
    }

    // friday full: A registered, P and Q waiting, both registered saturday
    const before = await prisma.slot.findUniqueOrThrow({ where: { id: sun } });
    expect(before.waitingListReregistered).toEqual([ids.P, ids.Q]);

    notified.length = 0;
    const res = await deleteSlotById({
      pollId: poll.id,
      password: PASSWORD,
      slotId: sat,
    });
    expect(res?.serverError).toBeUndefined();

    const slots = await prisma.slot.findMany({
      where: { pollId: poll.id },
      orderBy: [{ startDate: "asc" }, { id: "asc" }],
    });
    expect(slots.map((slot) => slot.id)).toEqual([fri, sun]);
    expect(slots[0].registered).toEqual([ids.A]);
    expect(slots[0].waitingList).toEqual([ids.P, ids.Q]);
    expect(slots[1].registered).toEqual([ids.P, ids.Q]);
    expect(slots[1].waitingListReregistered).toEqual([]);
    expect(notified).toEqual([
      { slotId: sun, voteId: ids.P },
      { slotId: sun, voteId: ids.Q },
    ]);
  });
});
