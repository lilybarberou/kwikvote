import { describe, expect, expectTypeOf, test } from "vitest";
import { z } from "zod";

import { POLL_SLOTS_MAX_COUNT } from "./poll-schema";
import { createVoteSchema } from "./vote-schema";

const choice = (i: number) => ({
  id: `choice-${i}`,
  slotId: `slot-${i}`,
  choice: 1,
});
const choices = (count: number) =>
  Array.from({ length: count }, (_, i) => choice(i));
// what the vote form of a registration poll sends: a priority on each choice
const priorityChoices = (count: number) =>
  choices(count).map((choice, i) => ({ ...choice, priority: i % 2 === 0 }));
const vote = (data: object) => ({
  id: "vote",
  name: "Lily",
  pollId: "poll",
  choices: [choice(0)],
  ...data,
});

describe("createVoteSchema", () => {
  test("what the vote form sends is accepted", () => {
    expect(createVoteSchema.safeParse(vote({})).success).toBe(true);
    expect(
      createVoteSchema.safeParse(
        vote({
          choices: choices(7),
          subscription: { endpoint: "https://push", auth: "a", p256dh: "p" },
        }),
      ).success,
    ).toBe(true);
    expect(
      createVoteSchema.safeParse(vote({ choices: priorityChoices(7) })).success,
    ).toBe(true);
    // a poll can't have no slot, but the check is the server action's
    expect(createVoteSchema.safeParse(vote({ choices: [] })).success).toBe(
      true,
    );
  });

  test("the choices are limited to one per slot of the biggest poll", () => {
    expect(POLL_SLOTS_MAX_COUNT).toBe(50);
    // with or without the priority of the registration polls
    for (const make of [choices, priorityChoices]) {
      expect(
        createVoteSchema.safeParse(vote({ choices: make(50) })).success,
      ).toBe(true);

      const res = createVoteSchema.safeParse(vote({ choices: make(51) }));
      expect(res.success).toBe(false);
      expect(res.error?.issues).toEqual([
        expect.objectContaining({
          path: ["choices"],
          message: "Un vote peut avoir 50 choix au maximum",
        }),
      ]);
    }
  });

  test("a huge array is refused before its elements are read", () => {
    // what fits in the 1 MB body of a server action: [1,1,1,…]
    const huge = new Array(524_288).fill(1);

    const start = performance.now();
    const res = createVoteSchema.safeParse(vote({ choices: huge }));
    const duration = performance.now() - start;

    expect(res.success).toBe(false);
    // instead of one per element (about 200 MB of memory)
    expect(res.error!.issues.length).toBeLessThanOrEqual(3);
    expect(duration).toBeLessThan(100);
  });

  test("invalid choices are still refused", () => {
    for (const choices of [
      null,
      "1",
      1,
      {},
      [1],
      [{ id: "c", slotId: "s" }],
      [{ ...choice(0), priority: "true" }],
    ])
      expect(createVoteSchema.safeParse(vote({ choices })).success).toBe(false);
  });

  test("the inferred types are unchanged", () => {
    // priority: registration polls only (docs/vote-prioritaire.md)
    type Choices = {
      id: string;
      slotId: string;
      choice: number;
      priority?: boolean;
    }[];
    expectTypeOf<
      z.infer<typeof createVoteSchema>["choices"]
    >().toEqualTypeOf<Choices>();
    expectTypeOf<
      z.input<typeof createVoteSchema>["choices"]
    >().toEqualTypeOf<Choices>();
  });
});
