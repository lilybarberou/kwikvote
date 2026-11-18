import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";

import {
  sendNotifications,
  sendSlotUpdateNotifications,
} from "./notifications.server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: {
    DOMAIN: "https://kwikvote.test",
    NEXT_PUBLIC_VAPID_EMAIL: "test@example.invalid",
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: "public",
    VAPID_PRIVATE_KEY: "private",
  },
}));

// no push notification: record them
const push = vi.hoisted(() => ({
  sent: [] as { endpoint: string; payload: Record<string, string> }[],
  fail: new Set<string>(),
}));
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: async (sub: { endpoint: string }, payload: string) => {
      if (push.fail.has(sub.endpoint)) throw new Error("410 Gone");
      push.sent.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) });
      return { statusCode: 201 };
    },
  },
}));

const db = vi.hoisted(() => ({
  // endpoints of each vote
  votes: {} as Record<string, string[]>,
  // endpoint -> poll ids of its votes
  subscriptions: {} as Record<string, string[]>,
  queries: [] as unknown[],
}));
const sub = (endpoint: string) => ({
  endpoint,
  auth: "auth",
  p256dh: "p256dh",
});
vi.mock("@/prisma/db", () => ({
  prisma: {
    vote: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in
          .filter((id) => db.votes[id])
          .map((id) => ({ id, subscriptions: db.votes[id].map(sub) })),
    },
    subscription: {
      findMany: async (query: {
        where: {
          votes: { some: { pollId: string } };
          endpoint?: { not: string };
        };
      }) => {
        db.queries.push(query.where);
        return Object.entries(db.subscriptions)
          .filter(
            ([endpoint, pollIds]) =>
              pollIds.includes(query.where.votes.some.pollId) &&
              endpoint !== query.where.endpoint?.not,
          )
          .map(([endpoint]) => sub(endpoint));
      },
    },
  },
}));

const logs = vi.spyOn(console, "log").mockImplementation(() => {});
afterAll(() => logs.mockRestore());

// the notifications are sent without waiting
const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  push.sent.length = 0;
  push.fail.clear();
  db.votes = {};
  db.subscriptions = {};
  db.queries.length = 0;
});

type Slots = Parameters<typeof sendNotifications>[0]["initialPoll"];
const slot = (id: string, startDate: string, registered: string[]) =>
  ({
    id,
    pollId: "poll",
    startDate: new Date(startDate),
    endDate: new Date(startDate),
    maxParticipants: 2,
    registered,
    waitingList: [],
    waitingListReregistered: [],
    notComing: [],
  }) as Slots[0];

const registration = (before: Slots, after: Slots, voteId: string) => {
  const poll = { id: "poll", slots: after } as Parameters<
    typeof sendNotifications
  >[0]["poll"];
  return {
    pollId: "poll",
    poll,
    newPoll: poll,
    initialPoll: before,
    voteId,
  };
};

describe("sendNotifications", () => {
  test("only the newly registered are notified, not the author of the vote", async () => {
    db.votes = {
      author: ["https://push.invalid/author"],
      kept: ["https://push.invalid/kept"],
      newOne: [
        "https://push.invalid/new-phone",
        "https://push.invalid/new-laptop",
      ],
    };

    await sendNotifications(
      registration(
        [slot("fri", "2030-06-07T08:00:00Z", ["kept"])],
        [slot("fri", "2030-06-07T08:00:00Z", ["kept", "author", "newOne"])],
        "author",
      ),
    );
    await flush();

    expect(push.sent.map((s) => s.endpoint)).toEqual([
      "https://push.invalid/new-phone",
      "https://push.invalid/new-laptop",
    ]);
    expect(push.sent[0].payload).toEqual({
      title: "Vous êtes inscrit !",
      // 10:00 in Paris (summer time)
      body: "Bonne nouvelle, vous avez intégré les inscrits du vendredi 7 à 10:00 !",
      link: "https://kwikvote.test/poll/poll",
    });
  });

  test("registered on two slots at once: one notification, for the first one", async () => {
    db.votes = { P: ["https://push.invalid/P"] };

    await sendNotifications(
      registration(
        [
          slot("fri", "2030-01-11T17:30:00Z", []),
          slot("sat", "2030-01-12T17:30:00Z", []),
        ],
        [
          slot("fri", "2030-01-11T17:30:00Z", ["P"]),
          slot("sat", "2030-01-12T17:30:00Z", ["P"]),
        ],
        "",
      ),
    );
    await flush();

    expect(push.sent).toHaveLength(1);
    // 18:30 in Paris (winter time)
    expect(push.sent[0].payload.body).toBe(
      "Bonne nouvelle, vous avez intégré les inscrits du vendredi 11 à 18:30 !",
    );
  });

  test("nobody newly registered, or without subscription: nothing is sent", async () => {
    db.votes = { kept: ["https://push.invalid/kept"] };

    await sendNotifications(
      registration(
        [slot("fri", "2030-06-07T08:00:00Z", ["kept"])],
        [slot("fri", "2030-06-07T08:00:00Z", ["kept", "noSub"])],
        "",
      ),
    );
    await flush();

    expect(push.sent).toEqual([]);
  });

  test("a failed push doesn't stop the other ones", async () => {
    db.votes = {
      A: ["https://push.invalid/expired"],
      B: ["https://push.invalid/B"],
    };
    push.fail.add("https://push.invalid/expired");

    await sendNotifications(
      registration(
        [slot("fri", "2030-06-07T08:00:00Z", [])],
        [slot("fri", "2030-06-07T08:00:00Z", ["A", "B"])],
        "",
      ),
    );
    await flush();

    expect(push.sent.map((s) => s.endpoint)).toEqual([
      "https://push.invalid/B",
    ]);
  });
});

describe("sendSlotUpdateNotifications", () => {
  const update = (
    newSlot: { startDate: string; endDate: string },
    exceptEndpoint?: string,
  ) =>
    sendSlotUpdateNotifications({
      pollId: "poll",
      slotId: "fri",
      pollTitle: "Foot",
      oldSlot: {
        startDate: new Date("2030-06-07T08:00:00Z"),
        endDate: new Date("2030-06-07T10:00:00Z"),
      },
      newSlot: {
        startDate: new Date(newSlot.startDate),
        endDate: new Date(newSlot.endDate),
      },
      exceptEndpoint,
    });

  test("the voters of the poll are told the new time, not the author of the change", async () => {
    db.subscriptions = {
      "https://push.invalid/A": ["poll"],
      "https://push.invalid/author": ["poll"],
      "https://push.invalid/other-poll": ["other"],
    };

    await update(
      { startDate: "2030-06-07T16:00:00Z", endDate: "2030-06-07T18:30:00Z" },
      "https://push.invalid/author",
    );
    await flush();

    expect(db.queries).toEqual([
      {
        votes: { some: { pollId: "poll" } },
        endpoint: { not: "https://push.invalid/author" },
      },
    ]);
    expect(push.sent).toEqual([
      {
        endpoint: "https://push.invalid/A",
        payload: {
          title: "Changement d'horaire",
          body: "Le créneau du vendredi 7 juin à 10:00 du sondage Foot a changé : vendredi 7 juin de 18:00 à 20:30.",
          // one tag per slot
          link: "https://kwikvote.test/poll/poll?tab=votes&slot=fri",
        },
      },
    ]);
  });

  test("a slot over two days, in Paris time", async () => {
    db.subscriptions = { "https://push.invalid/A": ["poll"] };

    // 23:00 to 01:00 in Paris, the same UTC day
    await update({
      startDate: "2030-06-07T21:00:00Z",
      endDate: "2030-06-07T23:00:00Z",
    });
    await flush();

    expect(db.queries).toEqual([
      { votes: { some: { pollId: "poll" } }, endpoint: undefined },
    ]);
    expect(push.sent[0].payload.body).toBe(
      "Le créneau du vendredi 7 juin à 10:00 du sondage Foot a changé : du vendredi 7 juin à 23:00 au samedi 8 juin à 01:00.",
    );
  });

  test("nobody subscribed: nothing is sent", async () => {
    await update({
      startDate: "2030-06-07T16:00:00Z",
      endDate: "2030-06-07T18:00:00Z",
    });
    await flush();
    expect(push.sent).toEqual([]);
  });
});
