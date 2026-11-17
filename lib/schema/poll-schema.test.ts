import { describe, expect, expectTypeOf, test } from "vitest";
import { z } from "zod";

import {
  POLL_SLOTS_MAX_COUNT,
  createPollSchema,
  pollFormSchema,
} from "./poll-schema";

const valid = {
  type: 2,
  title: "Foot",
  timeBeforeAllowedType: 2,
  msBeforeAllowed: 3 * 60 * 60 * 1000,
  slots: [
    {
      startDate: new Date("2099-06-12T16:00:00Z"),
      endDate: new Date("2099-06-12T18:00:00Z"),
      maxParticipants: 10,
    },
  ],
};
const parse = (data: object) =>
  createPollSchema.safeParse({ ...valid, ...data }).success;

describe("createPollSchema", () => {
  test("what the creation form sends is accepted", () => {
    expect(parse({})).toBe(true);
    // dates serialized as strings
    expect(
      parse({
        slots: [
          {
            startDate: "2099-06-12T16:00:00Z",
            endDate: "2099-06-12T18:00:00Z",
            maxParticipants: 1,
          },
        ],
      }),
    ).toBe(true);
  });

  test("what the form can't send is refused", () => {
    expect(parse({ title: "" })).toBe(false);
    expect(parse({ msBeforeAllowed: -1 })).toBe(false);
    expect(parse({ msBeforeAllowed: 1.5 })).toBe(false);
    expect(parse({ timeBeforeAllowedType: 3 })).toBe(false);
    expect(parse({ slots: [] })).toBe(false);
    expect(
      parse({
        slots: [
          {
            startDate: "not a date",
            endDate: "2099-06-12",
            maxParticipants: 1,
          },
        ],
      }),
    ).toBe(false);
    // null or a number would become a 1970 date
    for (const date of [null, 0, true])
      expect(
        parse({
          slots: [
            { startDate: date, endDate: "2099-06-12", maxParticipants: 1 },
          ],
        }),
      ).toBe(false);
  });
});

describe("number of slots", () => {
  const slots = (count: number) => Array(count).fill(valid.slots[0]);

  test("50 slots at most", () => {
    expect(POLL_SLOTS_MAX_COUNT).toBe(50);
    expect(parse({ slots: slots(50) })).toBe(true);

    const res = createPollSchema.safeParse({ ...valid, slots: slots(51) });
    expect(res.success).toBe(false);
    expect(res.error?.issues).toEqual([
      expect.objectContaining({
        path: ["slots"],
        message: "Un sondage peut avoir 50 créneaux au maximum",
      }),
    ]);
  });

  test("a huge array is refused before its elements are read", () => {
    // what fits in the 1 MB body of a server action: [1,1,1,…]
    const huge = new Array(524_288).fill(1);

    const start = performance.now();
    const res = createPollSchema.safeParse({ ...valid, slots: huge });
    const duration = performance.now() - start;

    expect(res.success).toBe(false);
    // instead of one per element (about 200 MB of memory)
    expect(res.error!.issues.length).toBeLessThanOrEqual(3);
    expect(duration).toBeLessThan(100);
  });

  test("not an array is still refused", () => {
    for (const value of [undefined, null, "1", 1, {}])
      expect(parse({ slots: value })).toBe(false);
  });

  test("the creation form has the same limit", () => {
    const formSlot = {
      startDate: new Date("2099-06-12"),
      startTime: "16:00",
      endDate: new Date("2099-06-12"),
      endTime: "18:00",
      maxParticipants: 10,
    };
    const form = (count: number) =>
      pollFormSchema.safeParse({
        type: "1",
        title: "Foot",
        timeBeforeAllowedType: "1",
        slots: Array(count).fill(formSlot),
      }).success;
    expect(form(50)).toBe(true);
    expect(form(51)).toBe(false);
  });

  test("the inferred types are unchanged", () => {
    type Slots = { startDate: Date; endDate: Date; maxParticipants: number }[];
    expectTypeOf<
      z.infer<typeof createPollSchema>["slots"]
    >().toEqualTypeOf<Slots>();
    expectTypeOf<z.input<typeof createPollSchema>["slots"]>().toEqualTypeOf<
      {
        startDate: string | Date;
        endDate: string | Date;
        maxParticipants: number;
      }[]
    >();
  });
});
