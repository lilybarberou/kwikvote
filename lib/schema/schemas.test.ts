import { describe, expect, test } from "vitest";

import { pollFormSchema, updatePollSchema } from "./poll-schema";
import { slotFormSchema, updateSlotSchema } from "./slot-schema";
import { createSubscriptionSchema } from "./subscription-schema";
import {
  VOTE_NAME_MAX_LENGTH,
  createVoteSchema,
  deleteVoteSchema,
  updateVoteNameSchema,
} from "./vote-schema";

describe("slotFormSchema", () => {
  const slot = (start: [Date, string], end: [Date, string]) =>
    slotFormSchema.safeParse({
      startDate: start[0],
      startTime: start[1],
      endDate: end[0],
      endTime: end[1],
    });
  const day = new Date(2026, 5, 12);
  const nextDay = new Date(2026, 5, 13);

  test("the end must be after the start", () => {
    expect(slot([day, "18:00"], [day, "20:00"]).success).toBe(true);
    // over midnight
    expect(slot([day, "23:00"], [nextDay, "01:00"]).success).toBe(true);

    for (const end of [
      [day, "18:00"],
      [day, "17:59"],
      [new Date(2026, 5, 11), "20:00"],
    ] as [Date, string][]) {
      const res = slot([day, "18:00"], end);
      expect(res.success).toBe(false);
      expect(res.error?.issues).toEqual([
        expect.objectContaining({
          path: ["endTime"],
          message: "La fin du créneau doit être après son début",
        }),
      ]);
    }
  });

  test("an invalid time is only reported on its field", () => {
    const res = slot([day, "8h"], [day, "20:00"]);
    expect(res.success).toBe(false);
    expect(res.error?.issues.map((issue) => issue.path)).toEqual([
      ["startTime"],
    ]);
  });
});

describe("updateSlotSchema", () => {
  test("the dates are sent serialized", () => {
    const res = updateSlotSchema.parse({
      slotId: "s",
      startDate: "2026-06-12T16:00:00.000Z",
      endDate: "2026-06-12T18:00:00.000Z",
    });
    expect(res.startDate).toEqual(new Date("2026-06-12T16:00:00.000Z"));
    expect(
      updateSlotSchema.safeParse({
        slotId: "s",
        startDate: "not a date",
        endDate: "2026-06-12",
      }).success,
    ).toBe(false);
  });
});

describe("pollFormSchema", () => {
  const form = {
    type: "2",
    title: "Foot",
    timeBeforeAllowedType: "2",
    hoursBeforeAllowed: "3",
    slots: [
      {
        startDate: new Date(2026, 5, 12),
        startTime: "18:00",
        endDate: new Date(2026, 5, 12),
        endTime: "20:00",
        maxParticipants: "10",
      },
    ],
  };
  const parse = (data: object) =>
    pollFormSchema.safeParse({ ...form, ...data }).success;

  test("hours and participants typed in the form", () => {
    expect(parse({})).toBe(true);
    expect(parse({ hoursBeforeAllowed: 3 })).toBe(true);
    expect(parse({ email: "" })).toBe(true);
    expect(parse({ email: "alice@example.invalid" })).toBe(true);

    expect(parse({ email: "alice" })).toBe(false);
    expect(parse({ hoursBeforeAllowed: "-3" })).toBe(false);
    expect(parse({ hoursBeforeAllowed: "1.5" })).toBe(false);
    expect(parse({ hoursBeforeAllowed: 0 })).toBe(false);
    expect(parse({ type: "3" })).toBe(false);
    expect(parse({ slots: [{ ...form.slots[0], maxParticipants: "0" }] })).toBe(
      false,
    );
  });

  test("updatePollSchema needs the password", () => {
    expect(updatePollSchema.safeParse({ title: "Foot" }).success).toBe(false);
    expect(
      updatePollSchema.safeParse({ title: "Foot", password: "pw" }).success,
    ).toBe(true);
    expect(
      updatePollSchema.safeParse({ title: "", password: "pw" }).success,
    ).toBe(false);
  });
});

describe("vote schemas", () => {
  const vote = {
    id: "v",
    name: "Alice",
    pollId: "p",
    choices: [{ id: "c", slotId: "s", choice: 1 }],
  };

  test("the name is limited", () => {
    const name = "a".repeat(VOTE_NAME_MAX_LENGTH);
    expect(createVoteSchema.safeParse({ ...vote, name }).success).toBe(true);
    expect(
      createVoteSchema.safeParse({ ...vote, name: name + "a" }).success,
    ).toBe(false);
    expect(
      updateVoteNameSchema.safeParse({ voteId: "v", name: name + "a" }).success,
    ).toBe(false);
    expect(updateVoteNameSchema.safeParse({ voteId: "v", name }).success).toBe(
      true,
    );
  });

  test("the priority is optional, a subscription is complete", () => {
    expect(createVoteSchema.parse(vote).choices[0].priority).toBeUndefined();
    expect(
      createVoteSchema.safeParse({
        ...vote,
        subscription: { endpoint: "e", auth: "a" },
      }).success,
    ).toBe(false);
    expect(
      createVoteSchema.safeParse({
        ...vote,
        choices: [{ id: "c", slotId: "s", choice: "1" }],
      }).success,
    ).toBe(false);
  });

  test("deleting a vote needs its poll", () => {
    expect(deleteVoteSchema.safeParse({ voteId: "v" }).success).toBe(false);
    expect(
      deleteVoteSchema.safeParse({ voteId: "v", pollId: "p" }).success,
    ).toBe(true);
  });
});

describe("createSubscriptionSchema", () => {
  test("the keys of the browser subscription", () => {
    expect(
      createSubscriptionSchema.safeParse({
        endpoint: "https://push.invalid/1",
        keys: { auth: "a", p256dh: "p" },
      }).success,
    ).toBe(true);
    expect(
      createSubscriptionSchema.safeParse({
        endpoint: "https://push.invalid/1",
        keys: { auth: "a" },
      }).success,
    ).toBe(false);
  });
});
