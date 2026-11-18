import { prisma } from "@/prisma/db";
import { v4 } from "uuid";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";

import { createVote, deleteVote } from "./mutation";

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
    // same rule as lib/notifications.server.ts: newly registered, not the author
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

// a registration poll whose reregistration times are far away
const createRegistrationPoll = async (maxParticipants: number[]) => {
  const start = Date.now() + 365 * DAY;
  return prisma.poll.create({
    data: {
      type: 2,
      title: "integration test",
      slots: {
        create: maxParticipants.map((max, index) => ({
          startDate: new Date(start + index * DAY),
          endDate: new Date(start + index * DAY + 2 * 60 * 60 * 1000),
          maxParticipants: max,
        })),
      },
    },
    include: { slots: { orderBy: [{ startDate: "asc" }, { id: "asc" }] } },
  });
};

type Poll = Awaited<ReturnType<typeof createRegistrationPoll>>;

const vote = async (
  poll: Poll,
  voteId: string,
  answers: ("yes" | "yes*" | "no")[],
) => {
  const stored = await prisma.voteChoice.findMany({ where: { voteId } });
  const res = await createVote({
    id: voteId,
    name: voteId,
    pollId: poll.id,
    choices: poll.slots.map((slot, index) => ({
      id: stored.find((c) => c.slotId === slot.id)?.id ?? v4(),
      slotId: slot.id,
      choice: answers[index] === "no" ? 2 : 1,
      priority: answers[index] === "yes*",
    })),
  });
  expect(res?.serverError).toBeUndefined();
};

const slotsOf = async (poll: Poll) => {
  const slots = await prisma.slot.findMany({
    where: { pollId: poll.id },
    orderBy: [{ startDate: "asc" }, { id: "asc" }],
  });
  return slots.map(
    ({ registered, waitingList, waitingListReregistered, notComing }) => ({
      registered,
      waitingList,
      waitingListReregistered,
      notComing,
    }),
  );
};

const ids = () => {
  const suffix = v4().slice(0, 8);
  return (name: string) => `${name}-${suffix}`;
};

beforeEach(() => {
  notified.length = 0;
});

afterAll(async () => {
  await prisma.poll.deleteMany({ where: { title: "integration test" } });
  await prisma.$disconnect();
});

describe("createVote with priorities (local database)", () => {
  test("friday / saturday: the priority switches the spot, the freed one goes to the waiting list", async () => {
    const poll = await createRegistrationPoll([1, 2]);
    const [fri, sat] = poll.slots.map((slot) => slot.id);
    const id = ids();

    await vote(poll, id("P"), ["yes", "yes"]);
    await vote(poll, id("Z"), ["yes", "no"]);
    expect(await slotsOf(poll)).toEqual([
      {
        registered: [id("P")],
        waitingList: [id("Z")],
        waitingListReregistered: [],
        notComing: [],
      },
      {
        registered: [],
        waitingList: [],
        waitingListReregistered: [id("P")],
        notComing: [id("Z")],
      },
    ]);

    notified.length = 0;
    await vote(poll, id("P"), ["yes", "yes*"]);

    expect(await slotsOf(poll)).toEqual([
      {
        registered: [id("Z")],
        waitingList: [],
        waitingListReregistered: [id("P")],
        notComing: [],
      },
      {
        registered: [id("P")],
        waitingList: [],
        waitingListReregistered: [],
        notComing: [id("Z")],
      },
    ]);
    // Z is told about friday, P made the change and isn't notified
    expect(notified).toEqual([{ slotId: fri, voteId: id("Z") }]);

    const stored = await prisma.voteChoice.findMany({
      where: { voteId: id("P") },
    });
    expect(stored.find((c) => c.slotId === sat)?.priority).toBe(true);
    expect(stored.find((c) => c.slotId === fri)?.priority).toBe(false);
  });

  test("a priority on a no is not stored, a client without priority keeps it", async () => {
    const poll = await createRegistrationPoll([2, 2]);
    const [fri, sat] = poll.slots.map((slot) => slot.id);
    const id = ids();

    await createVote({
      id: id("P"),
      name: "P",
      pollId: poll.id,
      choices: [
        { id: v4(), slotId: fri, choice: 2, priority: true },
        { id: v4(), slotId: sat, choice: 1, priority: true },
      ],
    });
    const stored = await prisma.voteChoice.findMany({
      where: { voteId: id("P") },
    });
    expect(stored.find((c) => c.slotId === fri)?.priority).toBe(false);
    expect(stored.find((c) => c.slotId === sat)?.priority).toBe(true);

    // previous version of the client: no priority field
    await createVote({
      id: id("P"),
      name: "P renamed",
      pollId: poll.id,
      choices: stored.map(({ id, slotId }) => ({ id, slotId, choice: 1 })),
    });
    const after = await prisma.voteChoice.findMany({
      where: { voteId: id("P") },
    });
    expect(after.find((c) => c.slotId === sat)?.priority).toBe(true);
    expect(after.find((c) => c.slotId === fri)?.priority).toBe(false);
  });

  test("deleting the vote of the priority holder gives its spot to the waiting list", async () => {
    const poll = await createRegistrationPoll([1, 1]);
    const [, sat] = poll.slots.map((slot) => slot.id);
    const id = ids();

    await vote(poll, id("P"), ["yes", "yes*"]);
    await vote(poll, id("W"), ["no", "yes"]);
    expect((await slotsOf(poll))[1].waitingList).toEqual([id("W")]);

    const res = await deleteVote({ voteId: id("P"), pollId: poll.id });
    expect(res?.serverError).toBeUndefined();

    expect((await slotsOf(poll))[1].registered).toEqual([id("W")]);
    expect(notified).toEqual([{ slotId: sat, voteId: id("W") }]);
  });

  test("two simultaneous priorities for the last saturday spot: one gets it, the other keeps friday", async () => {
    const poll = await createRegistrationPoll([2, 1]);
    const id = ids();
    await vote(poll, id("P"), ["yes", "yes"]);
    await vote(poll, id("Q"), ["yes", "yes"]);

    await Promise.all([
      vote(poll, id("P"), ["yes", "yes*"]),
      vote(poll, id("Q"), ["yes", "yes*"]),
    ]);

    const [fri, sat] = await slotsOf(poll);
    expect(sat.registered).toHaveLength(1);
    const winner = sat.registered[0];
    const other = winner === id("P") ? id("Q") : id("P");
    expect(sat.waitingList).toEqual([other]);
    expect(fri.registered).toEqual([other]);
    expect(fri.waitingListReregistered).toEqual([winner]);
  });

  test("many simultaneous votes and priority changes keep the slots consistent", async () => {
    const poll = await createRegistrationPoll([2, 2, 1]);
    const id = ids();
    const people = Array.from({ length: 12 }, (_, i) => id(`v${i}`));
    const answers = (i: number) =>
      [
        i % 3 === 0 ? "yes*" : "yes",
        i % 2 ? "yes" : "no",
        i % 4 === 1 ? "yes*" : "yes",
      ] as ("yes" | "yes*" | "no")[];

    await Promise.all(people.map((p, i) => vote(poll, p, answers(i))));
    // everyone changes their priorities at the same time
    await Promise.all(
      people.map((p, i) =>
        vote(
          poll,
          p,
          answers(i).map((a) =>
            a === "no" ? "no" : a === "yes" ? "yes*" : "yes",
          ),
        ),
      ),
    );

    const slots = await slotsOf(poll);
    const max = [2, 2, 1];
    slots.forEach((slot, index) => {
      expect(slot.registered.length).toBeLessThanOrEqual(max[index]);
      if (slot.registered.length < max[index])
        expect(slot.waitingList).toEqual([]);
      // each vote in exactly one array of each slot
      const all = [
        ...slot.registered,
        ...slot.waitingList,
        ...slot.waitingListReregistered,
        ...slot.notComing,
      ];
      expect([...all].sort()).toEqual([...people].sort());
    });
    // one confirmed spot per person before the reregistration times
    people.forEach((p) =>
      expect(
        slots.filter((slot) => slot.registered.includes(p)).length,
      ).toBeLessThanOrEqual(1),
    );
    // the 12 votes wait for each other on the poll lock: about 1 s alone,
    // 5 s seen on a loaded machine, the default limit
  }, 30_000);
});
