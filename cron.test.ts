import { createRequire } from "node:module";
import { describe, expect, test } from "vitest";

// cron.js only exports its functions when it is imported, it starts nothing
const { updateSlotsArray, getSlotsInVoteOrder } = createRequire(
  import.meta.url,
)("./cron.js");

type Choice = { slotId: string; choice: number; priority: boolean };

// what cron.js reads from the transaction
const fakeTx = (choicesByVoteId: Record<string, Choice[]>) => ({
  vote: {
    findUnique: async ({ where: { id } }: { where: { id: string } }) => ({
      choices: choicesByVoteId[id],
    }),
  },
});

const slot = (id: string, maxParticipants: number, arrays = {}) => ({
  id,
  maxParticipants,
  registered: [] as string[],
  waitingList: [] as string[],
  waitingListReregistered: [] as string[],
  notComing: [] as string[],
  ...arrays,
});

describe("cron.js", () => {
  test("same slots order as the app", () => {
    const slots = [slot("fri", 1), slot("sat", 1), slot("sun", 1)];
    const order = getSlotsInVoteOrder(slots, [
      { slotId: "fri", choice: 1, priority: false },
      { slotId: "sat", choice: 2, priority: true },
      { slotId: "sun", choice: 1, priority: true },
    ]);
    expect(order.map((s: { id: string }) => s.id)).toEqual([
      "sun",
      "fri",
      "sat",
    ]);
  });

  test("friday opening: a saturday priority keeps saturday and gets friday too", async () => {
    // P marked saturday as priority: registered saturday, reregistered friday
    const poll = {
      slots: [
        slot("fri", 2, { waitingListReregistered: ["P"] }),
        slot("sat", 2, { registered: ["P"] }),
      ],
    };
    const choices = {
      P: [
        { slotId: "fri", choice: 1, priority: false },
        { slotId: "sat", choice: 1, priority: true },
      ],
    };

    // thursday 17h: friday reregistrations open, not saturday ones
    const newPoll = await updateSlotsArray({
      tx: fakeTx(choices),
      voteIds: new Set(["P"]),
      poll,
      voteId: "P",
      timeBeforeAllowedPassed: { fri: true, sat: false },
    });

    expect(newPoll.slots[0].registered).toEqual(["P"]);
    expect(newPoll.slots[1].registered).toEqual(["P"]);
    expect(newPoll.slots[1].waitingListReregistered).toEqual([]);
  });

  test("without priority: unchanged, friday kept and saturday at its opening", async () => {
    const poll = {
      slots: [
        slot("fri", 2, { registered: ["P"] }),
        slot("sat", 2, { waitingListReregistered: ["P"] }),
      ],
    };
    const choices = {
      P: [
        { slotId: "fri", choice: 1, priority: false },
        { slotId: "sat", choice: 1, priority: false },
      ],
    };

    const newPoll = await updateSlotsArray({
      tx: fakeTx(choices),
      voteIds: new Set(["P"]),
      poll,
      voteId: "P",
      timeBeforeAllowedPassed: { fri: true, sat: true },
    });

    expect(newPoll.slots[0].registered).toEqual(["P"]);
    expect(newPoll.slots[1].registered).toEqual(["P"]);
  });
});
