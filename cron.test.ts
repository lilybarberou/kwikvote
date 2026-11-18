import { createRequire } from "node:module";
import { describe, expect, test } from "vitest";

import { openReregistrations } from "./lib/registration";

// cron.js only exports its functions when it is imported, it starts nothing
const require = createRequire(import.meta.url);
const cron = require("./cron.js");

type Choice = { slotId: string; choice: number; priority: boolean };

const slot = (id: string, maxParticipants: number, arrays = {}) => ({
  id,
  maxParticipants,
  registered: [] as string[],
  waitingList: [] as string[],
  waitingListReregistered: [] as string[],
  notComing: [] as string[],
  ...arrays,
});

const yes = (slotId: string, priority = false): Choice => ({
  slotId,
  choice: 1,
  priority,
});

describe("cron.js", () => {
  test("uses the rules of the app, not a copy of them", () => {
    const registration = require("./lib/registration.ts");
    expect(cron.getSlotsInVoteOrder).toBe(registration.getSlotsInVoteOrder);
    expect(cron.checkTimeBeforeAllow).toBe(registration.checkTimeBeforeAllow);
    expect(cron).not.toHaveProperty("updateSlotsArray");
  });
});

describe("openReregistrations (the cron, at the opening of a slot)", () => {
  test("friday opening: a saturday priority keeps saturday and gets friday too", () => {
    // P marked saturday as priority: registered saturday, reregistered friday
    const slots = [
      slot("fri", 2, { waitingListReregistered: ["P"] }),
      slot("sat", 2, { registered: ["P"] }),
    ];

    // thursday 17h: friday reregistrations open, not saturday ones
    openReregistrations({
      slots,
      choicesByVoteId: { P: [yes("fri"), yes("sat", true)] },
      timeBeforeAllowedPassed: { fri: true, sat: false },
    });

    expect(slots[0].registered).toEqual(["P"]);
    expect(slots[1].registered).toEqual(["P"]);
    expect(slots[0].waitingListReregistered).toEqual([]);
  });

  test("without priority: unchanged, friday kept and saturday at its opening", () => {
    const slots = [
      slot("fri", 2, { registered: ["P"] }),
      slot("sat", 2, { waitingListReregistered: ["P"] }),
    ];

    openReregistrations({
      slots,
      choicesByVoteId: { P: [yes("fri"), yes("sat")] },
      timeBeforeAllowedPassed: { fri: true, sat: true },
    });

    expect(slots[0].registered).toEqual(["P"]);
    expect(slots[1].registered).toEqual(["P"]);
  });

  test("a full slot: the reregistered people join the end of its waiting list", () => {
    const slots = [
      slot("fri", 1, {
        registered: ["A"],
        waitingList: ["W"],
        waitingListReregistered: ["P", "Q"],
      }),
    ];

    openReregistrations({
      slots,
      choicesByVoteId: {
        A: [yes("fri")],
        W: [yes("fri")],
        P: [yes("fri")],
        Q: [yes("fri")],
      },
      timeBeforeAllowedPassed: { fri: true },
    });

    expect(slots[0]).toMatchObject({
      registered: ["A"],
      waitingList: ["W", "P", "Q"],
      waitingListReregistered: [],
    });
  });

  test("a deleted vote left in the lists is skipped", () => {
    const slots = [
      slot("fri", 1, { waitingListReregistered: ["deleted", "P"] }),
    ];

    openReregistrations({
      slots,
      choicesByVoteId: { P: [yes("fri")] },
      timeBeforeAllowedPassed: { fri: true },
    });

    expect(slots[0].registered).toEqual(["P"]);
  });

  test("a spot freed on a slot not open yet goes to its waiting list", () => {
    // inconsistent data: P registered on friday and saturday before the
    // saturday opening, W waiting on saturday, P reregistered on sunday. At
    // the sunday opening, P is placed again: it keeps friday, leaves saturday
    // (not open yet) and gets sunday. Before, nobody got the saturday spot.
    const slots = [
      slot("fri", 2, { registered: ["P"] }),
      slot("sat", 1, { registered: ["P"], waitingList: ["W"] }),
      slot("sun", 2, { waitingListReregistered: ["P"] }),
    ];

    openReregistrations({
      slots,
      choicesByVoteId: {
        P: [yes("fri"), yes("sat"), yes("sun")],
        W: [yes("sat")],
      },
      timeBeforeAllowedPassed: { fri: false, sat: false, sun: true },
    });

    expect(slots.map((s) => s.registered)).toEqual([["P"], ["W"], ["P"]]);
    expect(slots[1].waitingListReregistered).toEqual(["P"]);
    expect(slots[1].waitingList).toEqual([]);
  });
});
