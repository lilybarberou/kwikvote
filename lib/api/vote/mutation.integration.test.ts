import { prisma } from "@/prisma/db";
import { v4 } from "uuid";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";

import { createVote, deleteVote, updateVoteName } from "./mutation";

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

const errors = vi.spyOn(console, "error").mockImplementation(() => {});

const DAY = 24 * 60 * 60 * 1000;
const TITLE = "integration test vote mutations";

const createPoll = async (type: number, maxParticipants = [1, 1]) => {
  const start = Date.now() + 365 * DAY;
  return prisma.poll.create({
    data: {
      type,
      title: TITLE,
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
type Poll = Awaited<ReturnType<typeof createPoll>>;

const choicesFor = (poll: Poll, choices: number[], priority?: boolean[]) =>
  poll.slots.map((slot, index) => ({
    id: v4(),
    slotId: slot.id,
    choice: choices[index],
    priority: priority?.[index],
  }));

const storedChoices = (voteId: string) =>
  prisma.voteChoice.findMany({
    where: { voteId },
    orderBy: { slot: { startDate: "asc" } },
  });

beforeEach(() => {
  notified.length = 0;
});

afterAll(async () => {
  errors.mockRestore();
  await prisma.poll.deleteMany({ where: { title: TITLE } });
  await prisma.subscription.deleteMany({
    where: { endpoint: { startsWith: "https://push.invalid/vote-test" } },
  });
  await prisma.$disconnect();
});

describe("createVote validation (local database)", () => {
  test("one choice for each slot of the poll, no more, no less", async () => {
    const poll = await createPoll(1, [0, 0]);
    const other = await createPoll(1, [0]);
    const [a, b] = poll.slots;
    const choice = (slotId: string) => ({ id: v4(), slotId, choice: 1 });

    for (const choices of [
      [choice(a.id)],
      [choice(a.id), choice(a.id)],
      [choice(a.id), choice(b.id), choice(other.slots[0].id)],
      [choice(a.id), choice(other.slots[0].id)],
      [],
    ]) {
      const id = v4();
      const res = await createVote({ id, name: "A", pollId: poll.id, choices });
      expect(res?.serverError).toBe(
        "Les créneaux du sondage ont changé, vérifiez vos choix",
      );
      expect(await prisma.vote.count({ where: { id } })).toBe(0);
    }
  });

  test("yes or no in a registration poll, maybe too in a free poll", async () => {
    const registration = await createPoll(2);
    const free = await createPoll(1);

    for (const [poll, choice, valid] of [
      [registration, 3, false],
      [registration, 0, false],
      [free, 3, true],
      [free, 4, false],
      [free, -1, false],
    ] as const) {
      const res = await createVote({
        id: v4(),
        name: "A",
        pollId: poll.id,
        choices: choicesFor(poll, [1, choice]),
      });
      expect(res?.serverError, `${poll.type} ${choice}`).toBe(
        valid ? undefined : "Choix invalides",
      );
    }
  });

  test("an unknown poll", async () => {
    const res = await createVote({
      id: v4(),
      name: "A",
      pollId: v4(),
      choices: [],
    });
    expect(res?.serverError).toBe("Ce sondage n'existe plus");
  });

  test("a vote of another poll can't be edited through this one", async () => {
    const poll = await createPoll(1, [0]);
    const other = await createPoll(1, [0]);
    const id = v4();
    await createVote({
      id,
      name: "Alice",
      pollId: other.id,
      choices: choicesFor(other, [1]),
    });

    const res = await createVote({
      id,
      name: "Hacked",
      pollId: poll.id,
      choices: choicesFor(poll, [2]),
    });
    expect(res?.serverError).toBe("Ce vote n'appartient pas à ce sondage");

    const vote = await prisma.vote.findUniqueOrThrow({ where: { id } });
    expect(vote).toMatchObject({ name: "Alice", pollId: other.id });
    expect((await storedChoices(id)).map((c) => c.choice)).toEqual([1]);
  });

  test("a name too long is refused", async () => {
    const poll = await createPoll(1, [0]);
    const res = await createVote({
      id: v4(),
      name: "a".repeat(101),
      pollId: poll.id,
      choices: choicesFor(poll, [1]),
    });
    expect(res?.validationErrors).toBeDefined();
  });
});

describe("createVote edits (local database)", () => {
  test("an edit updates the stored choices, whatever ids the client sends", async () => {
    const poll = await createPoll(1, [0, 0]);
    const id = v4();
    await createVote({
      id,
      name: "A",
      pollId: poll.id,
      choices: choicesFor(poll, [1, 2]),
    });
    const before = await storedChoices(id);

    // new random choice ids, as a stale client could send
    const res = await createVote({
      id,
      name: "Alice",
      pollId: poll.id,
      choices: choicesFor(poll, [3, 1]),
    });
    expect(res?.data).toEqual({ success: true });

    const after = await storedChoices(id);
    expect(after.map((c) => c.id)).toEqual(before.map((c) => c.id));
    expect(after.map((c) => c.choice)).toEqual([3, 1]);
    expect((await prisma.vote.findUniqueOrThrow({ where: { id } })).name).toBe(
      "Alice",
    );
  });

  test("a priority only on a yes of a registration poll, kept when not sent", async () => {
    const registration = await createPoll(2);
    const free = await createPoll(1);
    const regVote = v4();
    const freeVote = v4();

    await createVote({
      id: regVote,
      name: "A",
      pollId: registration.id,
      choices: choicesFor(registration, [1, 2], [true, true]),
    });
    await createVote({
      id: freeVote,
      name: "A",
      pollId: free.id,
      choices: choicesFor(free, [1, 1], [true, true]),
    });
    expect((await storedChoices(regVote)).map((c) => c.priority)).toEqual([
      true,
      false,
    ]);
    expect((await storedChoices(freeVote)).map((c) => c.priority)).toEqual([
      false,
      false,
    ]);

    // a client of a previous version sends no priority: the stored one is kept
    await createVote({
      id: regVote,
      name: "A",
      pollId: registration.id,
      choices: choicesFor(registration, [1, 1]),
    });
    expect((await storedChoices(regVote)).map((c) => c.priority)).toEqual([
      true,
      false,
    ]);
  });

  test("the browser subscription is linked to the votes, stored once", async () => {
    const poll = await createPoll(1, [0]);
    const subscription = {
      endpoint: `https://push.invalid/vote-test-${v4()}`,
      auth: "auth",
      p256dh: "p256dh",
    };
    const first = v4();
    const second = v4();
    for (const id of [first, second])
      await createVote({
        id,
        name: id,
        pollId: poll.id,
        choices: choicesFor(poll, [1]),
        subscription,
      });

    const stored = await prisma.subscription.findUniqueOrThrow({
      where: { endpoint: subscription.endpoint },
      include: { votes: { select: { id: true } } },
    });
    expect(stored.votes.map((v) => v.id).sort()).toEqual(
      [first, second].sort(),
    );
  });
});

describe("ids of deleted votes left in the slots arrays (local database)", () => {
  test("the next vote removes them and gives their spot", async () => {
    const poll = await createPoll(2, [1]);
    const [slot] = poll.slots;
    // a past concurrent write left a deleted vote registered
    const deleted = v4();
    await prisma.slot.update({
      where: { id: slot.id },
      data: { registered: [deleted], waitingList: [] },
    });

    const A = v4();
    const res = await createVote({
      id: A,
      name: "A",
      pollId: poll.id,
      choices: choicesFor(poll, [1]),
    });
    expect(res?.serverError).toBeUndefined();

    const stored = await prisma.slot.findUniqueOrThrow({
      where: { id: slot.id },
    });
    expect(stored.registered).toEqual([A]);
    expect(stored.waitingList).toEqual([]);
  });

  test("deleting a vote removes them too", async () => {
    const poll = await createPoll(2, [1]);
    const [slot] = poll.slots;
    const [A, B] = [v4(), v4()];
    for (const id of [A, B])
      await createVote({
        id,
        name: id,
        pollId: poll.id,
        choices: choicesFor(poll, [1]),
      });
    const deleted = v4();
    await prisma.slot.update({
      where: { id: slot.id },
      data: { waitingList: [deleted, B] },
    });

    await deleteVote({ voteId: A, pollId: poll.id });

    const stored = await prisma.slot.findUniqueOrThrow({
      where: { id: slot.id },
    });
    expect(stored.registered).toEqual([B]);
    expect(stored.waitingList).toEqual([]);
    expect(notified).toEqual([{ slotId: slot.id, voteId: B }]);
  });
});

describe("deleteVote (local database)", () => {
  test("only a vote of this poll", async () => {
    const poll = await createPoll(1, [0]);
    const other = await createPoll(1, [0]);
    const id = v4();
    await createVote({
      id,
      name: "A",
      pollId: other.id,
      choices: choicesFor(other, [1]),
    });

    for (const [voteId, pollId] of [
      [id, poll.id],
      [v4(), other.id],
    ]) {
      const res = await deleteVote({ voteId, pollId });
      expect(res?.serverError).toBe("Ce vote a déjà été supprimé");
    }
    expect(await prisma.vote.count({ where: { id } })).toBe(1);
  });

  test("a free poll: the vote and its choices are deleted", async () => {
    const poll = await createPoll(1, [0, 0]);
    const id = v4();
    await createVote({
      id,
      name: "A",
      pollId: poll.id,
      choices: choicesFor(poll, [1, 3]),
    });

    expect((await deleteVote({ voteId: id, pollId: poll.id }))?.data).toEqual({
      success: true,
    });
    expect(await prisma.vote.count({ where: { id } })).toBe(0);
    expect(await prisma.voteChoice.count({ where: { voteId: id } })).toBe(0);
    expect(notified).toEqual([]);
  });

  test("a registration poll: the first of the waiting list gets the spot and is notified", async () => {
    const poll = await createPoll(2, [1]);
    const [A, B, C] = [v4(), v4(), v4()];
    for (const id of [A, B, C])
      await createVote({
        id,
        name: id,
        pollId: poll.id,
        choices: choicesFor(poll, [1]),
      });

    await deleteVote({ voteId: A, pollId: poll.id });

    const slot = await prisma.slot.findUniqueOrThrow({
      where: { id: poll.slots[0].id },
    });
    expect(slot.registered).toEqual([B]);
    expect(slot.waitingList).toEqual([C]);
    expect(notified).toEqual([{ slotId: poll.slots[0].id, voteId: B }]);
  });
});

describe("updateVoteName (local database)", () => {
  test("renames the vote and links the subscription", async () => {
    const poll = await createPoll(1, [0]);
    const id = v4();
    await createVote({
      id,
      name: "A",
      pollId: poll.id,
      choices: choicesFor(poll, [1]),
    });
    const endpoint = `https://push.invalid/vote-test-${v4()}`;

    const res = await updateVoteName({
      voteId: id,
      name: "Alice",
      subscription: { endpoint, auth: "auth", p256dh: "p256dh" },
    });
    expect(res?.data).toEqual({ success: true });

    const vote = await prisma.vote.findUniqueOrThrow({
      where: { id },
      include: { subscriptions: true },
    });
    expect(vote.name).toBe("Alice");
    expect(vote.subscriptions.map((s) => s.endpoint)).toEqual([endpoint]);

    // without subscription: the name only
    await updateVoteName({ voteId: id, name: "Alicia" });
    expect((await prisma.vote.findUniqueOrThrow({ where: { id } })).name).toBe(
      "Alicia",
    );
  });

  test("an unknown vote, or a name too long", async () => {
    expect(
      (await updateVoteName({ voteId: v4(), name: "A" }))?.serverError,
    ).toBe("Une erreur est survenue, veuillez réessayer plus tard");
    expect(
      (await updateVoteName({ voteId: v4(), name: "a".repeat(101) }))
        ?.validationErrors,
    ).toBeDefined();
  });
});
