import { prisma } from "@/prisma/db";
import { v4 } from "uuid";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";

import { createSubscription } from "../subscription/mutation";
import { createComment } from "./mutations";

// no push notification: record them
const sent = vi.hoisted(
  () => [] as { endpoint: string; payload: Record<string, string> }[],
);
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: () => {},
    sendNotification: async (sub: { endpoint: string }, payload: string) => {
      sent.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) });
      return { statusCode: 201 };
    },
  },
}));

const logs = vi.spyOn(console, "log").mockImplementation(() => {});
const errors = vi.spyOn(console, "error").mockImplementation(() => {});

const TITLE = "integration test comments";
const ENDPOINT = "https://push.invalid/comment-test";
// the notifications are sent without waiting
const flush = () => new Promise((resolve) => setImmediate(resolve));

const endpoint = (name: string) => `${ENDPOINT}-${name}-${v4()}`;
const sub = (endpoint: string) => ({
  endpoint,
  auth: "auth",
  p256dh: "p256dh",
});

// a poll whose votes have these subscriptions
const createPoll = (votes: string[][]) =>
  prisma.poll.create({
    data: {
      title: TITLE,
      votes: {
        create: votes.map((endpoints, index) => ({
          name: `voter ${index}`,
          subscriptions: {
            connectOrCreate: endpoints.map((endpoint) => ({
              where: { endpoint },
              create: sub(endpoint),
            })),
          },
        })),
      },
    },
  });

beforeEach(() => {
  sent.length = 0;
});

afterAll(async () => {
  logs.mockRestore();
  errors.mockRestore();
  await prisma.poll.deleteMany({ where: { title: TITLE } });
  await prisma.subscription.deleteMany({
    where: { endpoint: { startsWith: ENDPOINT } },
  });
  await prisma.$disconnect();
});

describe("createComment (local database)", () => {
  test("stores the comment and notifies each subscription of the voters once, not the author", async () => {
    const [phone, laptop, author] = [
      endpoint("phone"),
      endpoint("laptop"),
      endpoint("author"),
    ];
    const other = endpoint("other-poll");
    // the phone voted twice
    const poll = await createPoll([[phone], [phone, laptop], [author]]);
    await createPoll([[other]]);

    const res = await createComment({
      comment: {
        pollId: poll.id,
        author: "Alice",
        text: "On amène un ballon ?",
      },
      exceptEndpoint: author,
    });
    await flush();

    expect(res?.data).toMatchObject({ pollId: poll.id, author: "Alice" });
    expect(await prisma.comment.count({ where: { pollId: poll.id } })).toBe(1);
    expect(sent.map((s) => s.endpoint).sort()).toEqual([laptop, phone].sort());
    expect(sent[0].payload).toEqual({
      title: "Nouveau commentaire !",
      body: `Il y a un nouveau commentaire de Alice sur le sondage ${TITLE}`,
      link: `${process.env.DOMAIN}/poll/${poll.id}?tab=comments`,
    });
  });

  test("no vote: stored, nobody notified", async () => {
    const poll = await createPoll([]);
    const res = await createComment({
      comment: { pollId: poll.id, author: "Alice", text: "Hello" },
    });
    await flush();
    expect(res?.data?.text).toBe("Hello");
    expect(sent).toEqual([]);
  });

  test("an unknown poll or a text too long is refused", async () => {
    const unknown = await createComment({
      comment: { pollId: v4(), author: "Alice", text: "Hello" },
    });
    expect(unknown?.serverError).toBe(
      "Une erreur est survenue, veuillez réessayer plus tard",
    );

    const poll = await createPoll([]);
    const tooLong = await createComment({
      comment: { pollId: poll.id, author: "Alice", text: "a".repeat(5001) },
    });
    expect(tooLong?.validationErrors).toBeDefined();
    expect(await prisma.comment.count({ where: { pollId: poll.id } })).toBe(0);
  });
});

describe("createSubscription (local database)", () => {
  test("a browser subscribing again updates its keys", async () => {
    const url = endpoint("browser");
    await createSubscription({
      endpoint: url,
      keys: { auth: "a1", p256dh: "p1" },
    });
    const res = await createSubscription({
      endpoint: url,
      keys: { auth: "a2", p256dh: "p2" },
    });

    expect(res?.data).toEqual({ success: true });
    expect(
      await prisma.subscription.findMany({
        where: { endpoint: url },
        select: { auth: true, p256dh: true },
      }),
    ).toEqual([{ auth: "a2", p256dh: "p2" }]);
  });
});
