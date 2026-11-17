import { POLL_SLOTS_MAX_COUNT } from "@/lib/schema/poll-schema";
import { CreateVoteSchema } from "@/lib/schema/vote-schema";
import { prisma } from "@/prisma/db";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, test, vi } from "vitest";

import { createPoll } from "./poll/mutation";
import { createVote } from "./vote/mutation";

// The arrays sent to the server actions are limited, and checked before their
// elements (lib/schema/array.ts): a too long one is a validation error, and
// nothing is written.

vi.mock("@/lib/utils.server", () => ({ sendDiscordMessage: async () => {} }));
const errors = vi.spyOn(console, "error").mockImplementation(() => {});

const TITLE = `integration test array limits ${randomUUID()}`;
const DAY = 24 * 60 * 60 * 1000;

// what fits in the 1 MB body of a server action: [1,1,1,…]
const huge = () => new Array(524_288).fill(1) as never;

const slots = (count: number) => {
  const start = new Date(Date.now() + 30 * DAY);
  return Array.from({ length: count }, (_, i) => ({
    startDate: new Date(start.getTime() + i * DAY),
    endDate: new Date(start.getTime() + i * DAY + 3600e3),
    maxParticipants: 10,
  }));
};
const newPoll = (data: { slots: ReturnType<typeof slots> }) =>
  createPoll({
    type: 1,
    title: TITLE,
    timeBeforeAllowedType: 1,
    msBeforeAllowed: 0,
    ...data,
  });
const storedPolls = () => prisma.poll.count({ where: { title: TITLE } });

afterAll(async () => {
  errors.mockRestore();
  await prisma.poll.deleteMany({ where: { title: TITLE } });
  await prisma.$disconnect();
});

describe("array limits of the server actions (local database)", () => {
  test("a poll with too many slots is refused, nothing is stored", async () => {
    for (const tooMany of [slots(POLL_SLOTS_MAX_COUNT + 1), huge()]) {
      const start = performance.now();
      const res = await newPoll({ slots: tooMany });
      const duration = performance.now() - start;

      expect(res?.data).toBeUndefined();
      expect(res?.serverError).toBeUndefined();
      expect(res?.validationErrors).toEqual({
        slots: { _errors: ["Un sondage peut avoir 50 créneaux au maximum"] },
      });
      // without reading the half a million elements
      expect(duration).toBeLessThan(1000);
    }
    expect(await storedPolls()).toBe(0);
  });

  test("a poll with the maximum of slots is created", async () => {
    const res = await newPoll({ slots: slots(POLL_SLOTS_MAX_COUNT) });
    expect(res?.serverError ?? res?.validationErrors).toBeUndefined();
    expect(await prisma.slot.count({ where: { pollId: res!.data! } })).toBe(
      POLL_SLOTS_MAX_COUNT,
    );
  });

  test("a vote with too many choices is refused, nothing is stored", async () => {
    const pollId = (await newPoll({ slots: slots(1) }))!.data!;
    const [slot] = await prisma.slot.findMany({ where: { pollId } });
    const choices = (count: number, priority?: boolean) =>
      Array.from({ length: count }, () => ({
        id: randomUUID(),
        slotId: slot.id,
        choice: 1,
        priority,
      }));
    const vote = (choices: CreateVoteSchema["choices"]) =>
      createVote({ id: randomUUID(), name: "Lily", pollId, choices });

    for (const tooMany of [
      choices(POLL_SLOTS_MAX_COUNT + 1),
      // with the priority of the registration polls
      choices(POLL_SLOTS_MAX_COUNT + 1, true),
      choices(POLL_SLOTS_MAX_COUNT + 1, false),
      huge(),
    ]) {
      const res = await vote(tooMany);
      expect(res?.data).toBeUndefined();
      expect(res?.serverError).toBeUndefined();
      expect(res?.validationErrors).toEqual({
        choices: { _errors: ["Un vote peut avoir 50 choix au maximum"] },
      });
    }
    expect(await prisma.vote.count({ where: { pollId } })).toBe(0);
    expect(await prisma.voteChoice.count({ where: { slotId: slot.id } })).toBe(
      0,
    );

    // the same vote with one choice per slot is stored
    const res = await vote(choices(1));
    expect(res?.serverError ?? res?.validationErrors).toBeUndefined();
    expect(await prisma.vote.count({ where: { pollId } })).toBe(1);
  });
});
