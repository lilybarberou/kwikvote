import { prisma } from "@/prisma/db";
import { v4 } from "uuid";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";

import { createComment } from "./api/comment/mutations";
import { sendPush } from "./push.server";

// the answer of the push service of each endpoint (201 by default, 0: no
// answer at all, a network error)
const push = vi.hoisted(() => ({
  status: {} as Record<string, number>,
  sent: [] as string[],
}));
// it rejects with a WebPushError, whose statusCode is the one of the push
// service
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: () => {},
    sendNotification: async (sub: { endpoint: string }) => {
      const statusCode = push.status[sub.endpoint] ?? 201;
      if (statusCode === 0) throw new Error("connect ECONNREFUSED");
      if (statusCode >= 400)
        throw Object.assign(new Error("Received unexpected response code"), {
          statusCode,
        });
      push.sent.push(sub.endpoint);
      return { statusCode };
    },
  },
}));

const logs = vi.spyOn(console, "log").mockImplementation(() => {});
const errors = vi.spyOn(console, "error").mockImplementation(() => {});

const TITLE = "integration test push";
const ENDPOINT = `https://push.invalid/push-test-${v4().slice(0, 8)}`;

// a vote of a new poll with a subscription per endpoint
const createVoteWithSubscriptions = async (endpoints: string[]) => {
  const poll = await prisma.poll.create({
    data: {
      title: TITLE,
      votes: {
        create: {
          name: "A",
          subscriptions: {
            create: endpoints.map((endpoint) => ({
              endpoint,
              auth: "auth",
              p256dh: "p256dh",
            })),
          },
        },
      },
    },
    include: { votes: true },
  });
  return { pollId: poll.id, voteId: poll.votes[0].id };
};

const subscriptionsOf = async (voteId: string) =>
  (
    await prisma.vote.findUniqueOrThrow({
      where: { id: voteId },
      include: { subscriptions: true },
    })
  ).subscriptions.map((sub) => sub.endpoint);

beforeEach(() => {
  push.status = {};
  push.sent.length = 0;
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

describe("sendPush", () => {
  test("404 or 410: the expired subscription is deleted, the vote is kept", async () => {
    const gone = `${ENDPOINT}-gone-${v4()}`;
    const notFound = `${ENDPOINT}-not-found-${v4()}`;
    const alive = `${ENDPOINT}-alive-${v4()}`;
    const { voteId } = await createVoteWithSubscriptions([
      gone,
      notFound,
      alive,
    ]);
    push.status[gone] = 410;
    push.status[notFound] = 404;

    for (const endpoint of [gone, notFound, alive])
      await sendPush({ endpoint, auth: "auth", p256dh: "p256dh" }, "{}");

    expect(push.sent).toEqual([alive]);
    expect(
      await prisma.subscription.count({
        where: { endpoint: { in: [gone, notFound] } },
      }),
    ).toBe(0);
    expect(await subscriptionsOf(voteId)).toEqual([alive]);
  });

  test("any other error (500, 429, 413, network): the subscription is kept", async () => {
    const endpoints = [500, 429, 413, 0].map(
      (status) => `${ENDPOINT}-${status}-${v4()}`,
    );
    const { voteId } = await createVoteWithSubscriptions(endpoints);
    [500, 429, 413, 0].forEach((status, index) => {
      push.status[endpoints[index]] = status;
    });

    for (const endpoint of endpoints)
      await sendPush({ endpoint, auth: "auth", p256dh: "p256dh" }, "{}");

    expect((await subscriptionsOf(voteId)).sort()).toEqual(
      [...endpoints].sort(),
    );
  });

  test("a subscription already deleted: no error", async () => {
    const endpoint = `${ENDPOINT}-unknown-${v4()}`;
    push.status[endpoint] = 410;
    await expect(
      sendPush({ endpoint, auth: "auth", p256dh: "p256dh" }, "{}"),
    ).resolves.toBeUndefined();
  });
});

describe("through the app: a new comment", () => {
  test("the expired subscriptions of the poll are deleted, the others notified", async () => {
    const gone = `${ENDPOINT}-comment-gone-${v4()}`;
    const alive = `${ENDPOINT}-comment-alive-${v4()}`;
    const { pollId, voteId } = await createVoteWithSubscriptions([gone, alive]);
    push.status[gone] = 410;

    const res = await createComment({
      comment: { pollId, author: "B", text: "Hello" },
    });
    expect(res?.serverError).toBeUndefined();

    // the notifications are sent after the answer, without waiting
    await vi.waitFor(async () =>
      expect(await subscriptionsOf(voteId)).toEqual([alive]),
    );
    expect(push.sent).toEqual([alive]);
  });
});
