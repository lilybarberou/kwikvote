import { afterEach, describe, expect, test, vi } from "vitest";

import { getCronSchedulesData } from "./registration";
import {
  ServerActionError,
  checkTimeBeforeAllow,
  getDate,
  getErrorMessage,
  getFormattedTimeBeforeAllowed,
  handleServerResponse,
  parisDateTimeToUtc,
  sameDay,
  timeTwoDigit,
  utcToParisDateTime,
} from "./utils";

const HOUR = 60 * 60 * 1000;

// only what checkTimeBeforeAllow reads from a slot
const slot = (id: string, startDate: string) =>
  ({ id, startDate: new Date(startDate) }) as Parameters<
    typeof checkTimeBeforeAllow
  >[0]["slots"][0];

const at = (date: string) => vi.setSystemTime(new Date(date));

afterEach(() => {
  vi.useRealTimers();
});

describe("sameDay", () => {
  test("same calendar day, whatever the time", () => {
    expect(
      sameDay(new Date(2026, 5, 12, 0, 0), new Date(2026, 5, 12, 23, 59)),
    ).toBe(true);
    expect(
      sameDay(new Date(2026, 5, 12, 23, 59), new Date(2026, 5, 13, 0, 0)),
    ).toBe(false);
    // same day of another month or year
    expect(sameDay(new Date(2026, 5, 12), new Date(2026, 6, 12))).toBe(false);
    expect(sameDay(new Date(2026, 5, 12), new Date(2027, 5, 12))).toBe(false);
  });
});

describe("getDate and timeTwoDigit", () => {
  // shown in the browser time zone
  test("french day and time of a local date", () => {
    const date = new Date(2026, 5, 12, 9, 5);
    expect(getDate(date)).toBe("vendredi 12/06");
    expect(timeTwoDigit(date)).toBe("09:05");
    // serialized dates too
    expect(timeTwoDigit(date.toISOString() as unknown as Date)).toBe("09:05");
  });
});

describe("parisDateTimeToUtc", () => {
  // the day picked in the form is a local date, the time is a Paris time
  test.each([
    ["winter (UTC+1)", [2026, 0, 15], "18:30", "2026-01-15T17:30:00.000Z"],
    ["summer (UTC+2)", [2026, 6, 1], "10:00", "2026-07-01T08:00:00.000Z"],
    [
      "summer, just after midnight",
      [2026, 6, 1],
      "00:15",
      "2026-06-30T22:15:00.000Z",
    ],
    [
      "day before the switch to summer time",
      [2026, 2, 28],
      "10:00",
      "2026-03-28T09:00:00.000Z",
    ],
    [
      "day of the switch to summer time",
      [2026, 2, 29],
      "10:00",
      "2026-03-29T08:00:00.000Z",
    ],
    [
      "day of the switch to winter time",
      [2026, 9, 25],
      "12:00",
      "2026-10-25T11:00:00.000Z",
    ],
  ] as const)("%s", (_, [y, m, d], time, expected) => {
    expect(parisDateTimeToUtc(new Date(y, m, d), time).toISOString()).toBe(
      expected,
    );
  });

  test("the time of the picked date is ignored", () => {
    expect(
      parisDateTimeToUtc(
        new Date(2026, 0, 15, 22, 47, 13),
        "08:00",
      ).toISOString(),
    ).toBe("2026-01-15T07:00:00.000Z");
  });
});

describe("utcToParisDateTime", () => {
  test("the Paris day and time of a date", () => {
    const { date, time } = utcToParisDateTime(new Date("2026-06-30T22:15:00Z"));
    expect(time).toBe("00:15");
    // already the 1st of July in Paris
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([
      2026, 6, 1,
    ]);
  });

  test("round trip with parisDateTimeToUtc", () => {
    for (const iso of [
      "2026-01-15T17:30:00Z",
      "2026-03-29T08:00:00Z",
      "2026-06-30T22:15:00Z",
      "2026-10-25T11:00:00Z",
      "2026-12-31T23:00:00Z",
    ]) {
      const { date, time } = utcToParisDateTime(new Date(iso));
      expect(parisDateTimeToUtc(date, time).getTime()).toBe(
        new Date(iso).getTime(),
      );
    }
  });
});

describe("getFormattedTimeBeforeAllowed", () => {
  test("hours before the slot or the day before at 17h", () => {
    expect(
      getFormattedTimeBeforeAllowed({
        timeBeforeAllowedType: 2,
        msBeforeAllowed: 3 * HOUR,
      }),
    ).toBe("3h avant le début du créneau");
    expect(
      getFormattedTimeBeforeAllowed({
        timeBeforeAllowedType: 1,
        msBeforeAllowed: 0,
      }),
    ).toBe("la veille à 17h");
  });
});

describe("handleServerResponse", () => {
  test("returns the data", () => {
    expect(handleServerResponse({ data: "poll-id" })).toBe("poll-id");
    expect(handleServerResponse({ data: { success: true } })).toEqual({
      success: true,
    });
    expect(handleServerResponse({ data: [] })).toEqual([]);
  });

  test("a server error keeps its message for the user", () => {
    let error: unknown;
    try {
      handleServerResponse({ serverError: "Mot de passe incorrect" });
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(ServerActionError);
    expect(getErrorMessage(error as Error)).toBe("Mot de passe incorrect");
  });

  test("the other errors get a generic message", () => {
    const errors: Error[] = [];
    for (const response of [
      undefined,
      { validationErrors: { name: { _errors: ["too long"] } } },
      { data: { success: false, message: "failed" } },
      {},
    ])
      try {
        handleServerResponse(response as never);
      } catch (err) {
        errors.push(err as Error);
      }

    expect(errors.map((err) => err.message)).toEqual([
      "An error occurred",
      "Validation error",
      "failed",
      "No data available in the response.",
    ]);
    for (const error of errors) {
      expect(error).not.toBeInstanceOf(ServerActionError);
      expect(getErrorMessage(error)).toBe("Veuillez réessayer plus tard");
    }
  });
});

describe("checkTimeBeforeAllow", () => {
  test("hours before: opened once the slot start minus the delay is passed", () => {
    vi.useFakeTimers();
    const slots = [slot("a", "2026-06-12T16:00:00Z")];
    const check = () =>
      checkTimeBeforeAllow({
        timeBeforeAllowedType: 2,
        msBeforeAllowed: 3 * HOUR,
        slots,
      }).a;

    at("2026-06-12T12:59:59.999Z");
    expect(check()).toBe(false);
    at("2026-06-12T13:00:00.000Z");
    expect(check()).toBe(false);
    at("2026-06-12T13:00:00.001Z");
    expect(check()).toBe(true);
  });

  test.each([
    // [slot start, last closed instant, first opened instant]
    ["summer", "2026-06-12T16:00:00Z", "2026-06-11T15:00:00.000Z"],
    // 00:30 in Paris on the 13th: the day before is the 12th, not the 11th
    [
      "just after midnight in Paris",
      "2026-06-12T22:30:00Z",
      "2026-06-12T15:00:00.000Z",
    ],
    ["winter", "2026-01-15T17:30:00Z", "2026-01-14T16:00:00.000Z"],
    // sunday of the switch to summer time: saturday 17h is still UTC+1
    [
      "day of the switch to summer time",
      "2026-03-29T08:00:00Z",
      "2026-03-28T16:00:00.000Z",
    ],
    // monday after it: sunday 17h is UTC+2
    [
      "day after the switch to summer time",
      "2026-03-30T08:00:00Z",
      "2026-03-29T15:00:00.000Z",
    ],
    [
      "day after the switch to winter time",
      "2026-10-26T09:00:00Z",
      "2026-10-25T16:00:00.000Z",
    ],
  ])("the day before at 17h, Paris time: %s", (_, start, opening) => {
    vi.useFakeTimers();
    const slots = [slot("a", start)];
    const check = () =>
      checkTimeBeforeAllow({
        timeBeforeAllowedType: 1,
        msBeforeAllowed: 0,
        slots,
      }).a;

    at(opening);
    expect(check()).toBe(false);
    vi.setSystemTime(new Date(opening).getTime() + 1);
    expect(check()).toBe(true);
  });

  test("one value per slot", () => {
    vi.useFakeTimers();
    at("2026-06-12T12:00:00Z");
    expect(
      checkTimeBeforeAllow({
        timeBeforeAllowedType: 2,
        msBeforeAllowed: HOUR,
        slots: [
          slot("past", "2026-06-12T12:30:00Z"),
          slot("later", "2026-06-12T14:00:00Z"),
        ],
      }),
    ).toEqual({ past: true, later: false });
  });

  test("the cron schedules are the opening times", () => {
    vi.useFakeTimers();
    at("2026-01-01T00:00:00Z");
    const slots = [
      slot("summer", "2026-06-12T16:00:00Z"),
      slot("midnight", "2026-06-12T22:30:00Z"),
      slot("dst", "2026-03-29T08:00:00Z"),
      slot("dst-after", "2026-03-30T08:00:00Z"),
      slot("winter", "2026-10-26T09:00:00Z"),
    ];

    for (const timeBeforeAllowedType of [1, 2]) {
      const params = {
        timeBeforeAllowedType,
        msBeforeAllowed: 5 * HOUR,
        slots,
      };
      at("2026-01-01T00:00:00Z");
      const schedules = getCronSchedulesData({ pollId: "poll", ...params });
      expect(schedules).toHaveLength(slots.length);

      for (const { slotId, schedule } of schedules) {
        vi.setSystemTime(schedule);
        expect(checkTimeBeforeAllow(params)[slotId]).toBe(false);
        vi.setSystemTime(schedule.getTime() + 1);
        expect(checkTimeBeforeAllow(params)[slotId]).toBe(true);
      }
    }
  });
});
