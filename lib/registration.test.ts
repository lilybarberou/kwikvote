import { describe, expect, test } from "vitest";

import {
  ChoicesByVoteId,
  RegistrationChoice,
  fillFreeSpots,
  getCronSchedulesData,
  getSlotsInVoteOrder,
  normalizeChoices,
  reconcileSlotsArrays,
  registerAfterSlotDeletion,
  registerVote,
} from "./registration";

type TestSlot = {
  id: string;
  maxParticipants: number;
  registered: string[];
  waitingList: string[];
  waitingListReregistered: string[];
  notComing: string[];
};

const slot = (
  id: string,
  maxParticipants: number,
  arrays: Partial<TestSlot> = {},
): TestSlot => ({
  id,
  maxParticipants,
  registered: [],
  waitingList: [],
  waitingListReregistered: [],
  notComing: [],
  ...arrays,
});

const yes = (slotId: string, priority = false): RegistrationChoice => ({
  slotId,
  choice: 1,
  priority,
});
const no = (slotId: string): RegistrationChoice => ({
  slotId,
  choice: 2,
  priority: false,
});

const closed = (slots: TestSlot[]) =>
  Object.fromEntries(slots.map((slot) => [slot.id, false]));

/**
 * In memory poll: same steps as the server actions (createVote, deleteVote),
 * without the database.
 */
const createPoll = (slots: TestSlot[]) => {
  const choicesByVoteId: ChoicesByVoteId = {};
  let timeBeforeAllowedPassed = closed(slots);

  const poll = {
    slots,
    choicesByVoteId,
    setTimePassed: (time: Record<string, boolean>) => {
      timeBeforeAllowedPassed = { ...timeBeforeAllowedPassed, ...time };
    },
    // create or edit a vote
    vote: (voteId: string, choices: RegistrationChoice[]) => {
      const oldChoices = choicesByVoteId[voteId];
      choicesByVoteId[voteId] = choices;
      registerVote({
        slots,
        voteId,
        choices,
        oldChoices,
        choicesByVoteId,
        timeBeforeAllowedPassed,
      });
      return poll;
    },
    remove: (voteId: string) => {
      slots.forEach((slot) => {
        for (const key of [
          "registered",
          "waitingList",
          "waitingListReregistered",
          "notComing",
        ] as const)
          slot[key] = slot[key].filter((id) => id !== voteId);
      });
      fillFreeSpots({ slots, choicesByVoteId, timeBeforeAllowedPassed });
      delete choicesByVoteId[voteId];
      return poll;
    },
    get: (slotId: string) => {
      const { registered, waitingList, waitingListReregistered } = slots.find(
        (slot) => slot.id === slotId,
      )!;
      return { registered, waitingList, waitingListReregistered };
    },
  };
  return poll;
};

describe("getSlotsInVoteOrder", () => {
  const slots = [slot("fri", 1), slot("sat", 1), slot("sun", 1)];

  test("without priority, the slots order", () => {
    expect(getSlotsInVoteOrder(slots, [yes("fri"), yes("sat")])).toBe(slots);
    expect(getSlotsInVoteOrder(slots, undefined)).toBe(slots);
  });

  test("priority slots first, each group in the slots order", () => {
    const order = getSlotsInVoteOrder(slots, [
      yes("fri"),
      yes("sat", true),
      yes("sun", true),
    ]);
    expect(order.map((slot) => slot.id)).toEqual(["sat", "sun", "fri"]);
  });

  test("a priority on a no is ignored", () => {
    const order = getSlotsInVoteOrder(slots, [
      yes("fri"),
      { slotId: "sat", choice: 2, priority: true },
    ]);
    expect(order).toBe(slots);
  });
});

describe("normalizeChoices", () => {
  test("priority only on a yes of a registration poll", () => {
    const choices = [
      { slotId: "fri", choice: 1, priority: true },
      { slotId: "sat", choice: 2, priority: true },
    ];
    expect(
      normalizeChoices({ choices, pollType: 2 }).map((c) => c.priority),
    ).toEqual([true, false]);
    expect(
      normalizeChoices({ choices, pollType: 1 }).map((c) => c.priority),
    ).toEqual([false, false]);
  });

  test("a choice sent without priority keeps the stored one", () => {
    const storedChoices = [yes("fri", true), yes("sat")];
    const normalized = normalizeChoices({
      choices: [
        { slotId: "fri", choice: 1 },
        { slotId: "sat", choice: 1, priority: true },
      ],
      storedChoices,
      pollType: 2,
    });
    expect(normalized.map((c) => c.priority)).toEqual([true, true]);
  });

  test("an explicit false removes the stored priority", () => {
    const normalized = normalizeChoices({
      choices: [{ slotId: "fri", choice: 1, priority: false }],
      storedChoices: [yes("fri", true)],
      pollType: 2,
    });
    expect(normalized[0].priority).toBe(false);
  });
});

describe("the friday / saturday example", () => {
  test("without priority: registered friday, reregistered saturday even with room", () => {
    const poll = createPoll([slot("fri", 2), slot("sat", 2)]);
    poll.vote("P", [yes("fri"), yes("sat")]);

    expect(poll.get("fri").registered).toEqual(["P"]);
    expect(poll.get("sat")).toEqual({
      registered: [],
      waitingList: [],
      waitingListReregistered: ["P"],
    });
  });

  test("saturday priority with room: registered saturday, friday spot goes to the first waiting", () => {
    const poll = createPoll([slot("fri", 1), slot("sat", 2)]);
    poll.vote("P", [yes("fri"), yes("sat")]);
    poll.vote("Z", [yes("fri"), no("sat")]);
    expect(poll.get("fri").waitingList).toEqual(["Z"]);

    poll.vote("P", [yes("fri"), yes("sat", true)]);

    expect(poll.get("sat")).toEqual({
      registered: ["P"],
      waitingList: [],
      waitingListReregistered: [],
    });
    expect(poll.get("fri")).toEqual({
      registered: ["Z"],
      waitingList: [],
      waitingListReregistered: ["P"],
    });
  });

  test("saturday priority while saturday is full: keeps friday, waits at the end of saturday waiting list", () => {
    const poll = createPoll([slot("fri", 1), slot("sat", 1)]);
    poll.vote("Y", [no("fri"), yes("sat")]);
    poll.vote("V", [no("fri"), yes("sat")]);
    poll.vote("P", [yes("fri"), yes("sat")]);
    poll.vote("Z", [yes("fri"), no("sat")]);
    expect(poll.get("sat")).toEqual({
      registered: ["Y"],
      waitingList: ["V"],
      waitingListReregistered: ["P"],
    });

    poll.vote("P", [yes("fri"), yes("sat", true)]);

    // nobody loses their place: P is behind V, and keeps friday meanwhile
    expect(poll.get("sat")).toEqual({
      registered: ["Y"],
      waitingList: ["V", "P"],
      waitingListReregistered: [],
    });
    expect(poll.get("fri")).toEqual({
      registered: ["P"],
      waitingList: ["Z"],
      waitingListReregistered: [],
    });

    // first spot on saturday: V, who was waiting before
    poll.remove("Y");
    expect(poll.get("sat").registered).toEqual(["V"]);
    expect(poll.get("fri").registered).toEqual(["P"]);

    // next one: P switches to saturday, Z gets friday
    poll.remove("V");
    expect(poll.get("sat")).toEqual({
      registered: ["P"],
      waitingList: [],
      waitingListReregistered: [],
    });
    expect(poll.get("fri")).toEqual({
      registered: ["Z"],
      waitingList: [],
      waitingListReregistered: ["P"],
    });
  });

  test("removing the priority gives friday back only if it has room", () => {
    const poll = createPoll([slot("fri", 1), slot("sat", 2)]);
    poll.vote("P", [yes("fri"), yes("sat", true)]);
    poll.vote("Z", [yes("fri"), no("sat")]);
    expect(poll.get("fri").registered).toEqual(["Z"]);

    // friday full: P keeps saturday and waits at the end of friday
    poll.vote("P", [yes("fri"), yes("sat")]);
    expect(poll.get("sat").registered).toEqual(["P"]);
    expect(poll.get("fri")).toEqual({
      registered: ["Z"],
      waitingList: ["P"],
      waitingListReregistered: [],
    });

    // friday frees up: chronological order again, P goes back to friday
    poll.remove("Z");
    expect(poll.get("fri").registered).toEqual(["P"]);
    expect(poll.get("sat")).toEqual({
      registered: [],
      waitingList: [],
      waitingListReregistered: ["P"],
    });
  });

  test("removing the priority with room on friday: switches back, saturday spot goes to its waiting list", () => {
    const poll = createPoll([slot("fri", 2), slot("sat", 1)]);
    poll.vote("P", [yes("fri"), yes("sat", true)]);
    poll.vote("W", [no("fri"), yes("sat")]);
    expect(poll.get("sat").waitingList).toEqual(["W"]);

    poll.vote("P", [yes("fri"), yes("sat")]);

    expect(poll.get("fri").registered).toEqual(["P"]);
    expect(poll.get("sat")).toEqual({
      registered: ["W"],
      waitingList: [],
      waitingListReregistered: ["P"],
    });
  });

  test("deleting a vote with a priority frees its spot for the waiting list", () => {
    const poll = createPoll([slot("fri", 1), slot("sat", 1)]);
    poll.vote("P", [yes("fri"), yes("sat", true)]);
    poll.vote("W", [no("fri"), yes("sat")]);
    expect(poll.get("sat").waitingList).toEqual(["W"]);

    poll.remove("P");

    expect(poll.get("sat").registered).toEqual(["W"]);
    expect(poll.get("fri").waitingListReregistered).toEqual([]);
  });
});

describe("priority edge cases", () => {
  test("several priorities: first priority slot with room, in the slots order", () => {
    const poll = createPoll([slot("fri", 1), slot("sat", 1), slot("sun", 1)]);
    poll.vote("X", [no("fri"), yes("sat"), no("sun")]);
    poll.vote("P", [yes("fri"), yes("sat", true), yes("sun", true)]);

    expect(poll.get("sat").waitingList).toEqual(["P"]);
    expect(poll.get("sun").registered).toEqual(["P"]);
    expect(poll.get("fri")).toEqual({
      registered: [],
      waitingList: [],
      waitingListReregistered: ["P"],
    });
  });

  test("all slots as priority is the same as no priority", () => {
    const run = (priority: boolean) => {
      const poll = createPoll([slot("fri", 1), slot("sat", 1), slot("sun", 2)]);
      poll.vote("A", [yes("fri", priority), yes("sat", priority), no("sun")]);
      poll.vote("B", [yes("fri", priority), yes("sat", priority), yes("sun")]);
      poll.vote("C", [
        yes("fri", priority),
        yes("sat", priority),
        yes("sun", priority),
      ]);
      poll.remove("A");
      return poll.slots;
    };
    expect(run(true)).toEqual(run(false));
  });

  test("a priority which doesn't change the order keeps the queue places", () => {
    const poll = createPoll([slot("fri", 1), slot("sat", 1)]);
    poll.vote("X", [no("fri"), yes("sat")]);
    poll.vote("P", [no("fri"), yes("sat")]);
    poll.vote("Q", [no("fri"), yes("sat")]);
    expect(poll.get("sat").waitingList).toEqual(["P", "Q"]);

    poll.vote("P", [no("fri"), yes("sat", true)]);

    expect(poll.get("sat").waitingList).toEqual(["P", "Q"]);
  });

  test("registered on the priority slot: the earlier slot becomes a reregistration", () => {
    const poll = createPoll([slot("fri", 1), slot("sat", 1)]);
    poll.vote("X", [yes("fri"), no("sat")]);
    poll.vote("P", [yes("fri"), yes("sat")]);
    expect(poll.get("fri").waitingList).toEqual(["P"]);
    expect(poll.get("sat").registered).toEqual(["P"]);

    poll.vote("P", [yes("fri"), yes("sat", true)]);

    // a friday spot would not be taken anymore before the reregistration time
    expect(poll.get("fri")).toEqual({
      registered: ["X"],
      waitingList: [],
      waitingListReregistered: ["P"],
    });
    poll.remove("X");
    expect(poll.get("fri").registered).toEqual([]);
    expect(poll.get("sat").registered).toEqual(["P"]);
  });

  test("after the reregistration time of a slot, the one slot limit doesn't apply to it", () => {
    const poll = createPoll([slot("fri", 2), slot("sat", 2)]);
    poll.setTimePassed({ fri: true });
    poll.vote("P", [yes("fri"), yes("sat", true)]);

    expect(poll.get("sat").registered).toEqual(["P"]);
    expect(poll.get("fri").registered).toEqual(["P"]);
  });

  test("a priority on a full slot: end of its waiting list, ahead of the reregistered only", () => {
    const poll = createPoll([slot("fri", 1), slot("sat", 1)]);
    poll.vote("A", [yes("fri"), yes("sat")]);
    poll.vote("B", [yes("fri"), yes("sat")]);
    expect(poll.get("sat")).toEqual({
      registered: ["B"],
      waitingList: [],
      waitingListReregistered: ["A"],
    });

    poll.vote("P", [yes("fri"), yes("sat", true)]);

    // A is already registered on friday, its first slot: like B waiting on
    // friday, P waits on saturday which is its first slot
    expect(poll.get("sat")).toEqual({
      registered: ["B"],
      waitingList: ["P"],
      waitingListReregistered: ["A"],
    });
    expect(poll.get("fri")).toEqual({
      registered: ["A"],
      waitingList: ["B", "P"],
      waitingListReregistered: [],
    });
  });

  test("a cascade on inconsistent arrays throws instead of looping", () => {
    // Z waits on friday but said no to it
    const slots = [slot("fri", 1, { waitingList: ["Z"] })];
    expect(() =>
      fillFreeSpots({
        slots,
        choicesByVoteId: { Z: [no("fri")] },
        timeBeforeAllowedPassed: closed(slots),
      }),
    ).toThrow();
  });
});

describe("slots updates with priorities", () => {
  test("reconcile keeps the priority slot, whatever the slots order", () => {
    const poll = createPoll([slot("fri", 1), slot("sat", 2)]);
    poll.vote("P", [yes("fri"), yes("sat", true)]);
    poll.vote("Z", [yes("fri"), no("sat")]);
    const before = JSON.parse(JSON.stringify(poll.slots));

    reconcileSlotsArrays({
      slots: poll.slots,
      choicesByVoteId: poll.choicesByVoteId,
      timeBeforeAllowedPassed: closed(poll.slots),
    });
    expect(poll.slots).toEqual(before);

    // saturday moved before friday
    const reversed = [...poll.slots].reverse();
    reconcileSlotsArrays({
      slots: reversed,
      choicesByVoteId: poll.choicesByVoteId,
      timeBeforeAllowedPassed: closed(reversed),
    });
    expect(poll.get("sat").registered).toEqual(["P"]);
    expect(poll.get("fri").registered).toEqual(["Z"]);
  });

  test("reconcile without priority on the vote: earliest slot", () => {
    const slots = [
      slot("fri", 1, { waitingListReregistered: ["P"] }),
      slot("sat", 1, { registered: ["P"] }),
    ];
    // P marked saturday, then its priority was lost: reconcile moves it back
    reconcileSlotsArrays({
      slots,
      choicesByVoteId: { P: [yes("fri"), yes("sat")] },
      timeBeforeAllowedPassed: closed(slots),
    });
    expect(slots[0].registered).toEqual(["P"]);
    expect(slots[1].waitingListReregistered).toEqual(["P"]);
  });

  test("priority slot deleted: the vote is placed on its other slots", () => {
    const poll = createPoll([slot("fri", 1), slot("sat", 1), slot("sun", 1)]);
    poll.vote("P", [yes("fri"), yes("sat"), yes("sun", true)]);
    expect(poll.get("sun").registered).toEqual(["P"]);
    expect(poll.get("fri").waitingListReregistered).toEqual(["P"]);

    // what deleteSlotById does: the slot and its choices are gone
    const slots = poll.slots.filter((slot) => slot.id !== "sun");
    const choicesByVoteId = { P: [yes("fri"), yes("sat")] };
    registerAfterSlotDeletion({
      slots,
      choicesByVoteId,
      timeBeforeAllowedPassed: closed(slots),
    });

    expect(slots[0].registered).toEqual(["P"]);
    expect(slots[1].waitingListReregistered).toEqual(["P"]);
  });
});

describe("getCronSchedulesData", () => {
  const day = 24 * 60 * 60 * 1000;

  test("every future slot, the first one included: a priority can reregister on it", () => {
    // P marked saturday as priority: registered saturday, reregistered friday
    const poll = createPoll([slot("fri", 2), slot("sat", 2)]);
    poll.vote("P", [yes("fri"), yes("sat", true)]);
    expect(poll.get("fri").waitingListReregistered).toEqual(["P"]);

    const fri = new Date(Date.now() + 2 * day);
    const sat = new Date(Date.now() + 3 * day);
    const schedules = getCronSchedulesData({
      pollId: "poll",
      timeBeforeAllowedType: 2,
      msBeforeAllowed: 60 * 60 * 1000,
      // not sorted: the slots order is applied
      slots: [
        { id: "sat", startDate: sat },
        { id: "fri", startDate: fri },
      ],
    });

    expect(schedules).toEqual([
      {
        pollId: "poll",
        slotId: "fri",
        schedule: new Date(fri.getTime() - 60 * 60 * 1000),
      },
      {
        pollId: "poll",
        slotId: "sat",
        schedule: new Date(sat.getTime() - 60 * 60 * 1000),
      },
    ]);
  });

  test("day before at 5pm (Paris), past slots left out", () => {
    const schedules = getCronSchedulesData({
      pollId: "poll",
      timeBeforeAllowedType: 1,
      msBeforeAllowed: 0,
      slots: [
        { id: "past", startDate: new Date(Date.now() - day) },
        // 2099-06-12 18:00 Paris (summer time, UTC+2)
        { id: "fri", startDate: new Date("2099-06-12T16:00:00Z") },
      ],
    });

    expect(schedules).toEqual([
      {
        pollId: "poll",
        slotId: "fri",
        schedule: new Date("2099-06-11T15:00:00Z"),
      },
    ]);
  });
});

describe("invariants on random polls with priorities", () => {
  // seeded random numbers, so a failure can be replayed
  const random = (seed: number) => () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };

  const check = (poll: ReturnType<typeof createPoll>, label: string) => {
    for (const [voteId, choices] of Object.entries(poll.choicesByVoteId)) {
      const order = getSlotsInVoteOrder(poll.slots, choices);
      const registeredOn = poll.slots.filter((slot) =>
        slot.registered.includes(voteId),
      );

      // before the reregistration times: one confirmed spot at most
      expect(registeredOn.length, label).toBeLessThanOrEqual(1);

      for (const slot of poll.slots) {
        const isYes =
          choices.find((choice) => choice.slotId === slot.id)?.choice === 1;
        const arrays = (
          [
            "registered",
            "waitingList",
            "waitingListReregistered",
            "notComing",
          ] as const
        ).filter((key) => slot[key].includes(voteId));
        // in exactly one array of each slot
        expect(arrays, label).toEqual([isYes ? arrays[0] : "notComing"]);
      }

      // registered on the first slot of its order which has room: the yes
      // slots before are full and it waits on them
      const registeredIndex = order.findIndex((slot) =>
        slot.registered.includes(voteId),
      );
      const before =
        registeredIndex === -1 ? order : order.slice(0, registeredIndex);
      for (const slot of before) {
        const isYes =
          choices.find((choice) => choice.slotId === slot.id)?.choice === 1;
        if (!isYes) continue;
        expect(slot.waitingList.includes(voteId), label).toBe(true);
        expect(slot.registered.length, label).toBe(slot.maxParticipants);
      }
    }

    for (const slot of poll.slots) {
      expect(slot.registered.length, label).toBeLessThanOrEqual(
        slot.maxParticipants,
      );
      // no free spot while someone waits for it
      if (slot.registered.length < slot.maxParticipants)
        expect(slot.waitingList, label).toEqual([]);
    }
  };

  test("one spot per person, full slots before it, no spot left to the waiting list", () => {
    for (let seed = 1; seed <= 1500; seed++) {
      const r = random(seed);
      const slotIds = ["a", "b", "c", "d"].slice(0, 1 + Math.floor(r() * 4));
      const poll = createPoll(
        slotIds.map((id) => slot(id, 1 + Math.floor(r() * 3))),
      );
      let nextId = 0;

      for (let step = 0; step < 20; step++) {
        const voteIds = Object.keys(poll.choicesByVoteId);
        const randomChoices = () =>
          slotIds.map((slotId) =>
            r() < 0.7 ? yes(slotId, r() < 0.35) : no(slotId),
          );
        const x = r();

        if (x < 0.45 || !voteIds.length)
          poll.vote(`v${nextId++}`, randomChoices());
        else if (x < 0.65) {
          // priorities only
          const voteId = voteIds[Math.floor(r() * voteIds.length)];
          poll.vote(
            voteId,
            poll.choicesByVoteId[voteId].map((choice) => ({
              ...choice,
              priority: choice.choice === 1 && r() < 0.5,
            })),
          );
        } else if (x < 0.8) {
          const voteId = voteIds[Math.floor(r() * voteIds.length)];
          poll.vote(voteId, randomChoices());
        } else poll.remove(voteIds[Math.floor(r() * voteIds.length)]);

        check(poll, `seed ${seed} step ${step}`);
      }
    }
    // about 2 s alone, but over 30 s seen on a loaded machine: not the
    // default 5 s limit
  }, 60_000);
});
