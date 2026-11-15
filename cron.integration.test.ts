import { createPoll } from "@/lib/api/poll/mutation";
import { createVote } from "@/lib/api/vote/mutation";
import { prisma } from "@/prisma/db";
import { installWebPushCopy } from "@/test/web-push-copy";
import { createRequire } from "node:module";
import { v4 } from "uuid";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";

// the app's notifications and Discord message are not sent
vi.mock("@/lib/notifications.server", () => ({
  sendNotifications: async () => {},
  sendSlotUpdateNotifications: async () => {},
}));
vi.mock("@/lib/utils.server", () => ({ sendDiscordMessage: async () => {} }));

// cron.js reuses the prisma client of prisma/db.ts (globalThis.prisma)
const require = createRequire(import.meta.url);
// no push notification from the cron: record them
const webpush = installWebPushCopy(require);
delete require.cache[require.resolve("./cron.js")];
const cron = require("./cron.js");

const sent: { endpoint: string; body: string }[] = [];
const sendNotification = vi
  .spyOn(webpush, "sendNotification")
  .mockImplementation((async (sub: { endpoint: string }, payload: string) => {
    sent.push({ endpoint: sub.endpoint, body: JSON.parse(payload).body });
    return { statusCode: 201 };
  }) as never);
const logs = vi.spyOn(console, "log").mockImplementation(() => {});

const TITLE = "integration test cron";
const ENDPOINT = "https://push.invalid/cron-test";
// the notifications are sent after the transaction, without waiting
const flush = () => new Promise((resolve) => setTimeout(resolve, 50));

beforeEach(() => {
  sent.length = 0;
  // only the date: prisma's timers keep running
  vi.useFakeTimers({ toFake: ["Date"] });
  // monday 3rd of june 2030
  vi.setSystemTime(new Date("2030-06-03T08:00:00Z"));
});

afterAll(async () => {
  vi.useRealTimers();
  sendNotification.mockRestore();
  logs.mockRestore();
  await prisma.poll.deleteMany({ where: { title: TITLE } });
  await prisma.subscription.deleteMany({
    where: { endpoint: { startsWith: ENDPOINT } },
  });
  await prisma.$disconnect();
});

describe("cron.js on a local database", () => {
  test("friday opening: the reregistered person with a saturday priority gets friday, notified once", async () => {
    // friday 7th and saturday 8th of june, 18:00 in Paris, opening the day before at 17h
    const res = await createPoll({
      type: 2,
      title: TITLE,
      timeBeforeAllowedType: 1,
      msBeforeAllowed: 0,
      slots: [
        {
          startDate: "2030-06-07T16:00:00Z",
          endDate: "2030-06-07T18:00:00Z",
          maxParticipants: 2,
        },
        {
          startDate: "2030-06-08T16:00:00Z",
          endDate: "2030-06-08T18:00:00Z",
          maxParticipants: 2,
        },
      ],
    });
    const pollId = res!.data!;
    const slots = await prisma.slot.findMany({
      where: { pollId },
      orderBy: { startDate: "asc" },
    });
    const [fri, sat] = slots.map((slot) => slot.id);

    // the first slot has its cron schedule too
    const schedules = await prisma.cronSchedule.findMany({
      where: { pollId },
      orderBy: { schedule: "asc" },
    });
    expect(schedules.map((s) => [s.slotId, s.schedule.toISOString()])).toEqual([
      [fri, "2030-06-06T15:00:00.000Z"],
      [sat, "2030-06-07T15:00:00.000Z"],
    ]);

    // P prefers saturday: registered saturday, reregistered friday
    const P = v4();
    const endpoint = `${ENDPOINT}-${v4()}`;
    const vote = await createVote({
      id: P,
      name: "P",
      pollId,
      choices: [
        { id: v4(), slotId: fri, choice: 1, priority: false },
        { id: v4(), slotId: sat, choice: 1, priority: true },
      ],
      subscription: { endpoint, auth: "auth", p256dh: "p256dh" },
    });
    expect(vote?.serverError).toBeUndefined();
    expect(
      (await prisma.slot.findUniqueOrThrow({ where: { id: fri } }))
        .waitingListReregistered,
    ).toEqual([P]);

    // thursday 16:59 in Paris: nothing due
    vi.setSystemTime(new Date("2030-06-06T14:59:00Z"));
    await cron.doStuff();
    expect(await prisma.cronSchedule.count({ where: { pollId } })).toBe(2);

    // thursday 17:01 in Paris: friday opens
    vi.setSystemTime(new Date("2030-06-06T15:01:00Z"));
    await cron.doStuff();
    await flush();

    const [friday, saturday] = await Promise.all(
      [fri, sat].map((id) => prisma.slot.findUniqueOrThrow({ where: { id } })),
    );
    expect(friday.registered).toEqual([P]);
    expect(friday.waitingListReregistered).toEqual([]);
    expect(saturday.registered).toEqual([P]);
    expect(
      (await prisma.cronSchedule.findMany({ where: { pollId } })).map(
        (s) => s.slotId,
      ),
    ).toEqual([sat]);
    expect(sent).toEqual([
      {
        endpoint,
        body: "Bonne nouvelle, vous avez intégré les inscrits du vendredi 7 à 18:00 !",
      },
    ]);

    // saturday opening: nothing more to do, the schedule is consumed
    vi.setSystemTime(new Date("2030-06-07T15:01:00Z"));
    await cron.doStuff();
    await flush();
    expect(await prisma.cronSchedule.count({ where: { pollId } })).toBe(0);
    expect(sent).toHaveLength(1);
  });

  test("full friday: the reregistered person joins its waiting list", async () => {
    const res = await createPoll({
      type: 2,
      title: TITLE,
      timeBeforeAllowedType: 2,
      msBeforeAllowed: 2 * 60 * 60 * 1000,
      slots: [
        {
          startDate: "2030-06-07T16:00:00Z",
          endDate: "2030-06-07T18:00:00Z",
          maxParticipants: 1,
        },
        {
          startDate: "2030-06-08T16:00:00Z",
          endDate: "2030-06-08T18:00:00Z",
          maxParticipants: 1,
        },
      ],
    });
    const pollId = res!.data!;
    const [fri, sat] = (
      await prisma.slot.findMany({
        where: { pollId },
        orderBy: { startDate: "asc" },
      })
    ).map((slot) => slot.id);
    const [A, P] = [v4(), v4()];
    await createVote({
      id: A,
      name: "A",
      pollId,
      choices: [
        { id: v4(), slotId: fri, choice: 1 },
        { id: v4(), slotId: sat, choice: 2 },
      ],
    });
    await createVote({
      id: P,
      name: "P",
      pollId,
      choices: [
        { id: v4(), slotId: fri, choice: 1, priority: false },
        { id: v4(), slotId: sat, choice: 1, priority: true },
      ],
    });

    // 2 hours before friday
    vi.setSystemTime(new Date("2030-06-07T14:00:01Z"));
    await cron.doStuff();

    const friday = await prisma.slot.findUniqueOrThrow({ where: { id: fri } });
    expect(friday.registered).toEqual([A]);
    expect(friday.waitingList).toEqual([P]);
    expect(friday.waitingListReregistered).toEqual([]);
  });
});

describe("cron.js: expired push subscriptions", () => {
  // a registration poll whose only vote, with a subscription, gets registered
  const registerOne = async () => {
    const endpoint = `${ENDPOINT}-${v4()}`;
    const poll = await prisma.poll.create({
      data: {
        title: TITLE,
        type: 2,
        slots: {
          create: {
            startDate: new Date("2030-06-07T16:00:00Z"),
            endDate: new Date("2030-06-07T18:00:00Z"),
            maxParticipants: 1,
          },
        },
        votes: {
          create: {
            name: "P",
            subscriptions: {
              create: { endpoint, auth: "auth", p256dh: "p256dh" },
            },
          },
        },
      },
      include: { slots: true, votes: true },
    });
    const voteId = poll.votes[0].id;
    const slot = poll.slots[0];
    await cron.sendNotifications({
      pollId: poll.id,
      poll,
      newPoll: { ...poll, slots: [{ ...slot, registered: [voteId] }] },
      initialPoll: [{ ...slot, registered: [] }],
    });
    return { endpoint, voteId };
  };

  const pushServiceAnswers = (statusCode: number) =>
    sendNotification.mockImplementationOnce((async () => {
      throw Object.assign(new Error("Received unexpected response code"), {
        statusCode,
      });
    }) as never);

  test.each([404, 410])(
    "%i from the push service: the subscription is deleted, the vote kept",
    async (statusCode) => {
      pushServiceAnswers(statusCode);
      const { endpoint, voteId } = await registerOne();

      await vi.waitFor(async () =>
        expect(await prisma.subscription.count({ where: { endpoint } })).toBe(
          0,
        ),
      );
      expect(await prisma.vote.count({ where: { id: voteId } })).toBe(1);
    },
  );

  test("500 from the push service: the subscription is kept", async () => {
    pushServiceAnswers(500);
    const { endpoint, voteId } = await registerOne();
    // the error is logged, nothing else done
    await vi.waitFor(() =>
      expect(logs).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 500 }),
      ),
    );
    await flush();

    expect(
      (
        await prisma.vote.findUniqueOrThrow({
          where: { id: voteId },
          include: { subscriptions: true },
        })
      ).subscriptions.map((sub) => sub.endpoint),
    ).toEqual([endpoint]);
  });
});
