import { createRequire } from "node:module";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";

import {
  ChoicesByVoteId,
  RegistrationChoice,
  fillFreeSpots,
  getSlotsInVoteOrder,
  registerVote,
} from "./lib/registration";
import { checkTimeBeforeAllow as appCheckTimeBeforeAllow } from "./lib/utils";

/**
 * cron.js against an in memory database: what a cron tick does to the slots
 * arrays, and the same opening times as the app.
 */

type Slot = {
  id: string;
  pollId: string;
  startDate: Date;
  maxParticipants: number;
  registered: string[];
  waitingList: string[];
  waitingListReregistered: string[];
  notComing: string[];
};
type Db = {
  polls: {
    id: string;
    title: string;
    timeBeforeAllowedType: number;
    msBeforeAllowed: number;
  }[];
  slots: Slot[];
  votes: {
    id: string;
    pollId: string;
    choices: RegistrationChoice[];
    subscriptions: { endpoint: string; auth: string; p256dh: string }[];
  }[];
  schedules: { id: string; pollId: string; schedule: Date }[];
};

let db: Db;
const clone = <T>(value: T): T => structuredClone(value);

// only the queries cron.js makes
const client = () => ({
  $executeRaw: async () => 0,
  cronSchedule: {
    findMany: async ({ where }: { where: { schedule: { lte: Date } } }) =>
      db.schedules
        .filter((s) => s.schedule <= where.schedule.lte)
        .map(({ id, pollId }) => ({ id, pollId })),
    deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
      db.schedules = db.schedules.filter((s) => !where.id.in.includes(s.id));
    },
  },
  poll: {
    findUnique: async ({ where }: { where: { id: string } }) => {
      const poll = db.polls.find((p) => p.id === where.id);
      if (!poll) return null;
      const slots = db.slots
        .filter((s) => s.pollId === poll.id)
        .sort(
          (a, b) =>
            a.startDate.getTime() - b.startDate.getTime() ||
            (a.id < b.id ? -1 : 1),
        )
        .map(({ pollId: _, ...slot }) => clone(slot));
      return { ...clone(poll), slots };
    },
  },
  vote: {
    findMany: async ({
      where,
    }: {
      where: { pollId?: string; id?: { in: string[] } };
    }) =>
      db.votes
        .filter((v) =>
          where.pollId
            ? v.pollId === where.pollId
            : where.id!.in.includes(v.id),
        )
        .map((v) => clone({ id: v.id, subscriptions: v.subscriptions })),
    findUnique: async ({ where }: { where: { id: string } }) => {
      const vote = db.votes.find((v) => v.id === where.id);
      return vote ? { choices: clone(vote.choices) } : null;
    },
  },
  slot: {
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<Slot>;
    }) => {
      const slot = db.slots.find((s) => s.id === where.id)!;
      Object.assign(slot, clone(data));
    },
  },
});

const fakePrisma = {
  ...client(),
  // a failed transaction leaves the database as it was
  $transaction: async (fn: (tx: ReturnType<typeof client>) => unknown) => {
    const before = clone(db);
    try {
      return await fn(client());
    } catch (err) {
      db = before;
      throw err;
    }
  },
};

// cron.js uses the prisma client of globalThis when there is one
const globalForPrisma = globalThis as unknown as { prisma: unknown };
const previousPrisma = globalForPrisma.prisma;
globalForPrisma.prisma = fakePrisma;
const require = createRequire(import.meta.url);
delete require.cache[require.resolve("./cron.js")];
const cron = require("./cron.js");

// no push notification: record them
const webpush = require("web-push");
const sent: {
  endpoint: string;
  payload: { title: string; body: string; link: string };
}[] = [];
const sendNotification = vi
  .spyOn(webpush, "sendNotification")
  .mockImplementation((async (sub: { endpoint: string }, payload: string) => {
    sent.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) });
    return { statusCode: 201 };
  }) as never);

const logs = vi.spyOn(console, "log").mockImplementation(() => {});

afterAll(() => {
  sendNotification.mockRestore();
  logs.mockRestore();
  vi.useRealTimers();
  globalForPrisma.prisma = previousPrisma;
});

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const T0 = new Date("2030-06-03T08:00:00Z").getTime();
// the polls slots open 12 hours before their start
const opening = (slotId: string) =>
  db.slots.find((s) => s.id === slotId)!.startDate.getTime() - 12 * HOUR;

const emptyArrays = () => ({
  registered: [] as string[],
  waitingList: [] as string[],
  waitingListReregistered: [] as string[],
  notComing: [] as string[],
});

const yes = (slotId: string, priority = false): RegistrationChoice => ({
  slotId,
  choice: 1,
  priority,
});
const no = (slotId: string): RegistrationChoice => ({
  slotId,
  choice: 2,
  priority: false,
});

beforeEach(() => {
  db = { polls: [], slots: [], votes: [], schedules: [] };
  sent.length = 0;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
});

describe("cron.js checkTimeBeforeAllow", () => {
  // seeded random numbers, so a failure can be replayed
  const random = (seed: number) => () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };

  test("same opening times as the app, summer and winter times included", () => {
    const r = random(42);
    const start = new Date("2026-01-01T00:00:00Z").getTime();
    for (let i = 0; i < 3000; i++) {
      // minutes precision: the boundaries are reached
      const startDate = new Date(
        start + Math.floor(r() * 730 * 24 * 60) * 60000,
      );
      const now = startDate.getTime() - Math.floor(r() * 3 * 24 * 60) * 60000;
      const params = {
        timeBeforeAllowedType: r() < 0.5 ? 1 : 2,
        msBeforeAllowed: Math.floor(r() * 48) * HOUR,
        slots: [{ id: "s", startDate }],
      };
      vi.setSystemTime(now);
      expect(
        cron.checkTimeBeforeAllow(params),
        `${startDate.toISOString()} at ${new Date(now).toISOString()}`,
      ).toEqual(appCheckTimeBeforeAllow(params as never));
    }
  });
});

describe("cron.js doStuff", () => {
  // a registration poll whose slots open 12 hours before their start
  const addPoll = (
    id: string,
    slots: { id: string; max: number; day: number }[],
  ) => {
    db.polls.push({
      id,
      title: `Poll ${id}`,
      timeBeforeAllowedType: 2,
      msBeforeAllowed: 12 * HOUR,
    });
    for (const slot of slots)
      db.slots.push({
        id: slot.id,
        pollId: id,
        startDate: new Date(T0 + slot.day * DAY),
        maxParticipants: slot.max,
        ...emptyArrays(),
      });
  };
  const addSchedule = (pollId: string, slotId: string) =>
    db.schedules.push({
      id: `cron-${slotId}`,
      pollId,
      schedule: new Date(opening(slotId)),
    });
  const arrays = (slotId: string) => {
    const { registered, waitingList, waitingListReregistered } = db.slots.find(
      (s) => s.id === slotId,
    )!;
    return { registered, waitingList, waitingListReregistered };
  };
  const setArrays = (slotId: string, value: Partial<Slot>) =>
    Object.assign(
      db.slots.find((s) => s.id === slotId)!,
      value,
    );
  const addVote = (pollId: string, id: string, choices: RegistrationChoice[]) =>
    db.votes.push({
      id,
      pollId,
      choices,
      subscriptions: [
        { endpoint: `https://push.invalid/${id}`, auth: "a", p256dh: "p" },
      ],
    });
  // the notifications are sent after the transaction, without waiting
  const flush = () => new Promise((resolve) => setImmediate(resolve));

  test("nothing due: nothing changes", async () => {
    addPoll("p", [{ id: "fri", max: 1, day: 4 }]);
    addSchedule("p", "fri");
    setArrays("fri", { waitingListReregistered: ["A"] });
    addVote("p", "A", [yes("fri")]);

    vi.setSystemTime(opening("fri") - 1);
    await cron.doStuff();

    expect(db.schedules).toHaveLength(1);
    expect(arrays("fri").waitingListReregistered).toEqual(["A"]);
  });

  test("at the opening, the reregistered get the free spots, in their order, and are notified", async () => {
    addPoll("p", [
      { id: "fri", max: 2, day: 4 },
      { id: "sat", max: 1, day: 5 },
    ]);
    addSchedule("p", "fri");
    addSchedule("p", "sat");
    // A and B are registered saturday, it was their priority
    setArrays("sat", { registered: ["A"], waitingList: ["B"] });
    setArrays("fri", {
      registered: ["C"],
      waitingListReregistered: ["A", "B"],
    });
    addVote("p", "A", [yes("fri"), yes("sat", true)]);
    addVote("p", "B", [yes("fri"), yes("sat", true)]);
    addVote("p", "C", [yes("fri"), no("sat")]);

    vi.setSystemTime(opening("fri") + 1);
    await cron.doStuff();
    await flush();

    // friday is due, saturday is not
    expect(db.schedules.map((s) => s.id)).toEqual(["cron-sat"]);
    expect(arrays("fri")).toEqual({
      registered: ["C", "A"],
      // full: B now waits like the others
      waitingList: ["B"],
      waitingListReregistered: [],
    });
    expect(arrays("sat")).toEqual({
      registered: ["A"],
      waitingList: ["B"],
      waitingListReregistered: [],
    });
    expect(sent).toEqual([
      {
        endpoint: "https://push.invalid/A",
        payload: {
          title: "Vous êtes inscrit !",
          // friday 7th of june 2030, 10:00 in Paris
          body: "Bonne nouvelle, vous avez intégré les inscrits du vendredi 7 à 10:00 !",
          link: `${process.env.DOMAIN}/poll/p`,
        },
      },
    ]);
  });

  test("ids of deleted votes are skipped", async () => {
    addPoll("p", [
      { id: "fri", max: 1, day: 4 },
      { id: "sat", max: 1, day: 5 },
    ]);
    addSchedule("p", "fri");
    setArrays("fri", { waitingListReregistered: ["deleted", "A"] });
    setArrays("sat", { registered: ["A"] });
    addVote("p", "A", [yes("fri"), yes("sat", true)]);

    vi.setSystemTime(opening("fri") + 1);
    await cron.doStuff();

    expect(arrays("fri").registered).toEqual(["A"]);
  });

  test("nobody to register: the reregistered of the opened slots join its waiting list", async () => {
    addPoll("p", [
      { id: "fri", max: 1, day: 4 },
      { id: "sat", max: 1, day: 5 },
    ]);
    addSchedule("p", "fri");
    setArrays("fri", {
      registered: ["C"],
      waitingList: ["D"],
      waitingListReregistered: ["A"],
    });
    setArrays("sat", { registered: ["A"], waitingListReregistered: ["C"] });
    addVote("p", "A", [yes("fri"), yes("sat", true)]);
    addVote("p", "C", [yes("fri"), yes("sat")]);
    addVote("p", "D", [yes("fri"), no("sat")]);

    vi.setSystemTime(opening("fri") + 1);
    await cron.doStuff();

    expect(arrays("fri")).toEqual({
      registered: ["C"],
      waitingList: ["D", "A"],
      waitingListReregistered: [],
    });
    // saturday is not opened yet
    expect(arrays("sat").waitingListReregistered).toEqual(["C"]);
    expect(db.schedules).toEqual([]);
  });

  test("a deleted poll: its schedules are removed", async () => {
    db.schedules.push({ id: "cron-x", pollId: "gone", schedule: new Date(T0) });
    vi.setSystemTime(T0 + 1);
    await cron.doStuff();
    expect(db.schedules).toEqual([]);
  });
});

describe("cron.js doStuff on random polls", () => {
  // seeded random numbers, so a failure can be replayed
  const random = (seed: number) => () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const keys = [
    "registered",
    "waitingList",
    "waitingListReregistered",
    "notComing",
  ] as const;

  const check = (
    slots: Slot[],
    choicesByVoteId: ChoicesByVoteId,
    opened: Record<string, boolean>,
    label: string,
  ) => {
    for (const [voteId, choices] of Object.entries(choicesByVoteId)) {
      for (const slot of slots) {
        const isYes = choices.find((c) => c.slotId === slot.id)?.choice === 1;
        const arrays = keys.filter((key) => slot[key].includes(voteId));
        // in exactly one array of each slot
        expect(arrays, `${label} ${voteId} ${slot.id}`).toEqual([
          isYes ? arrays[0] : "notComing",
        ]);
      }
      // before the opening of a slot, it is registered on one closed slot at most
      const closedRegistered = slots.filter(
        (slot) => !opened[slot.id] && slot.registered.includes(voteId),
      );
      expect(closedRegistered.length, `${label} ${voteId}`).toBeLessThanOrEqual(
        1,
      );
    }
    for (const slot of slots) {
      expect(slot.registered.length, label).toBeLessThanOrEqual(
        slot.maxParticipants,
      );
      const hasRoom = slot.registered.length < slot.maxParticipants;
      // no free spot while someone waits for it
      if (hasRoom) expect(slot.waitingList, `${label} ${slot.id}`).toEqual([]);
      // an opened slot has no reregistered left: registered or waiting
      if (opened[slot.id])
        expect(slot.waitingListReregistered, `${label} ${slot.id}`).toEqual([]);
    }
  };

  test("the app and the cron together keep the registration rules", async () => {
    for (let seed = 1; seed <= 400; seed++) {
      const r = random(seed);
      db = { polls: [], slots: [], votes: [], schedules: [] };
      vi.setSystemTime(T0);
      const slotIds = ["a", "b", "c", "d"].slice(0, 1 + Math.floor(r() * 4));
      db.polls.push({
        id: "p",
        title: "random",
        timeBeforeAllowedType: 2,
        msBeforeAllowed: 12 * HOUR,
      });
      slotIds.forEach((id, index) =>
        db.slots.push({
          id,
          pollId: "p",
          startDate: new Date(T0 + (index + 1) * DAY),
          maxParticipants: 1 + Math.floor(r() * 3),
          ...emptyArrays(),
        }),
      );
      // same objects as the cron's database
      const slots = db.slots;
      const choicesByVoteId: ChoicesByVoteId = {};
      const opened: Record<string, boolean> = Object.fromEntries(
        slotIds.map((id) => [id, false]),
      );
      let nextId = 0;
      let nextOpening = 0;

      for (let step = 0; step < 25; step++) {
        const label = `seed ${seed} step ${step}`;
        const voteIds = Object.keys(choicesByVoteId);
        const x = r();

        if (x < 0.15 && nextOpening < slotIds.length) {
          // the next slot opens: its cron schedule is due
          const slotId = slotIds[nextOpening++];
          opened[slotId] = true;
          db.schedules.push({
            id: `cron-${slotId}`,
            pollId: "p",
            schedule: new Date(opening(slotId)),
          });
          db.votes = Object.entries(choicesByVoteId).map(([id, choices]) => ({
            id,
            pollId: "p",
            choices,
            subscriptions: [],
          }));
          vi.setSystemTime(opening(slotId) + 1);
          await cron.doStuff();
          expect(db.schedules, label).toEqual([]);
          // the cron wrote new arrays: same objects for the app
          slots.splice(0, slots.length, ...db.slots);
        } else if (x < 0.75 || !voteIds.length) {
          // a vote is created or edited
          const isEdit = voteIds.length > 0 && r() < 0.3;
          const voteId = isEdit
            ? voteIds[Math.floor(r() * voteIds.length)]
            : `v${nextId++}`;
          const choices = slotIds.map((slotId) =>
            r() < 0.7 ? yes(slotId, r() < 0.35) : no(slotId),
          );
          const oldChoices = choicesByVoteId[voteId];
          choicesByVoteId[voteId] = choices;
          registerVote({
            slots,
            voteId,
            choices,
            oldChoices,
            choicesByVoteId,
            timeBeforeAllowedPassed: opened,
          });
        } else {
          // a vote is deleted
          const voteId = voteIds[Math.floor(r() * voteIds.length)];
          for (const slot of slots)
            for (const key of keys)
              slot[key] = slot[key].filter((id) => id !== voteId);
          fillFreeSpots({
            slots,
            choicesByVoteId,
            timeBeforeAllowedPassed: opened,
          });
          delete choicesByVoteId[voteId];
        }

        check(slots, choicesByVoteId, opened, label);
      }
    }
    // under a second alone, 15 s seen on a loaded machine: not the default
    // 5 s limit
  }, 60_000);

  test("each vote order is the app's one", () => {
    const slots = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const choices = [yes("a"), yes("b", true), { ...no("c"), priority: true }];
    expect(cron.getSlotsInVoteOrder(slots, choices)).toEqual(
      getSlotsInVoteOrder(slots, choices),
    );
  });
});
