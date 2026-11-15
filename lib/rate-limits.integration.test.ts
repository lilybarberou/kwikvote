import { createComment } from "@/lib/api/comment/mutations";
import { getPollsByEmail } from "@/lib/api/poll/query";
import { limiters } from "@/lib/rate-limits.server";
import { prisma } from "@/prisma/db";
import { setClientIp } from "@/test/client-ip";
import { v4 } from "uuid";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

// the limits of the actions anyone can call, on the local database
// (the password ones are in lib/safe-action.test.ts)

vi.mock("web-push", () => ({
  setVapidDetails: () => {},
  sendNotification: async () => ({ statusCode: 201 }),
}));
const errors = vi.spyOn(console, "error").mockImplementation(() => {});

const TITLE = "integration test rate limits";
const TOO_MANY = /^Trop d'essais, réessayez dans \d+ minutes?$/;

const createPoll = () => prisma.poll.create({ data: { title: TITLE } });
const comment = (pollId: string, text = "Bonjour") =>
  createComment({ comment: { author: "A", text, pollId } });

beforeEach(() => {
  Object.values(limiters).forEach((limiter) => limiter.reset());
  setClientIp("203.0.113.1");
});
afterEach(() => setClientIp(undefined));
afterAll(async () => {
  errors.mockRestore();
  await prisma.poll.deleteMany({ where: { title: TITLE } });
  await prisma.$disconnect();
});

describe("comments (local database)", () => {
  test("10 per address and poll in 10 minutes: the 11th is refused and not stored", async () => {
    const poll = await createPoll();
    const other = await createPoll();
    for (let i = 0; i < 10; i++)
      expect((await comment(poll.id))?.serverError).toBeUndefined();

    expect((await comment(poll.id, "11th"))?.serverError).toMatch(TOO_MANY);
    expect(await prisma.comment.count({ where: { pollId: poll.id } })).toBe(10);

    // another poll, or another address: allowed
    expect((await comment(other.id))?.serverError).toBeUndefined();
    setClientIp("203.0.113.2");
    expect((await comment(poll.id))?.serverError).toBeUndefined();
  });

  test("100 per poll in an hour, whatever the addresses", async () => {
    const poll = await createPoll();
    for (let i = 0; i < 100; i++) limiters.commentsByPoll.hit(poll.id);
    setClientIp("203.0.113.3");
    expect((await comment(poll.id))?.serverError).toMatch(TOO_MANY);
  });
});

describe("polls of an email (local database)", () => {
  test("20 searches per address in 10 minutes", async () => {
    for (let i = 0; i < 20; i++)
      expect(
        (await getPollsByEmail(`${v4()}@example.com`))?.serverError,
      ).toBeUndefined();
    expect((await getPollsByEmail("a@example.com"))?.serverError).toMatch(
      TOO_MANY,
    );

    setClientIp("203.0.113.2");
    expect((await getPollsByEmail("a@example.com"))?.data).toEqual([]);
  });
});
