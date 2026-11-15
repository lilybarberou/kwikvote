import { describe, expect, test } from "vitest";

import { createPollSchema } from "./poll-schema";

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
    // a slot ending before (or when) it starts, like updateSlotById
    for (const endDate of ["2099-06-12T16:00:00Z", "2099-06-12T15:00:00Z"])
      expect(
        parse({
          slots: [
            { startDate: "2099-06-12T16:00:00Z", endDate, maxParticipants: 1 },
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
