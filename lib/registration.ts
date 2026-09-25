import { fromZonedTime, toZonedTime } from "date-fns-tz";

// slots order matters for registrations, same start dates are ordered by id
// so every flow (db queries and js sorts) sees the same order
export const slotsOrderBy = [
  { startDate: "asc" as const },
  { id: "asc" as const },
];

export const compareSlots = (
  a: { id: string; startDate: Date | string },
  b: { id: string; startDate: Date | string },
) =>
  new Date(a.startDate).getTime() - new Date(b.startDate).getTime() ||
  (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

type SlotArrays = {
  id: string;
  maxParticipants: number;
  registered: string[];
  waitingList: string[];
  waitingListReregistered: string[];
  notComing: string[];
};

// only the arrays are written back, so a concurrent slot date update is never overwritten
export const getSlotArrays = ({
  registered,
  waitingList,
  waitingListReregistered,
  notComing,
}: SlotArrays) => ({
  registered,
  waitingList,
  waitingListReregistered,
  notComing,
});

// ids of deleted votes can have been left in the arrays by past concurrent
// writes: they would take a spot forever and break the votes recursion
export const removeDeletedVotes = <T extends SlotArrays>({
  slots,
  voteIds,
}: {
  slots: T[];
  voteIds: string[];
}) => {
  const existingVoteIds = new Set(voteIds);
  let isRemoved = false;

  slots.forEach((slot) => {
    for (const key of [
      "registered",
      "waitingList",
      "waitingListReregistered",
      "notComing",
    ] as const) {
      const ids = slot[key].filter((id) => existingVoteIds.has(id));
      if (ids.length !== slot[key].length) isRemoved = true;
      slot[key] = ids;
    }
  });

  return isRemoved;
};

export const getChoicesByVoteId = (
  votes: { id: string; choices: { slotId: string; choice: number }[] }[],
) =>
  Object.fromEntries(
    votes.map((vote) => [
      vote.id,
      Object.fromEntries(
        vote.choices.map((choice) => [choice.slotId, choice.choice]),
      ),
    ]),
  );

/**
 * Re-applies the registration rules on all the slots of a poll, after their
 * order or their reregistration time changed (slot dates update).
 *
 * Same rules as the votes recursion:
 * - a vote is registered on the first slot it said yes to and that has room
 * - on the following slots, it waits in the reregistered waiting list until
 *   the reregistration time of the slot has passed
 *
 * Queue order is kept: people ending in the array they started in keep their
 * place, people moving to another array are put at its end.
 * `slots` must be sorted like `slotsOrderBy`, they are updated in place.
 */
export const reconcileSlotsArrays = <T extends SlotArrays>({
  slots,
  choicesByVoteId,
  timeBeforeAllowedPassed,
}: {
  slots: T[];
  choicesByVoteId: Record<string, Record<string, number>>;
  timeBeforeAllowedPassed: Record<string, boolean>;
}) => {
  const isChoiceYes = (voteId: string, slotId: string) =>
    choicesByVoteId[voteId]?.[slotId] === 1;

  const initialWaitingLists = Object.fromEntries(
    slots.map((slot) => [
      slot.id,
      {
        waitingList: [...slot.waitingList],
        waitingListReregistered: [...slot.waitingListReregistered],
      },
    ]),
  );

  // put everyone in the right array according to the slots order
  const moveToRightArrays = () => {
    const isRegisteredOnce: Record<string, boolean> = {};

    for (const slot of slots) {
      const timePassed = timeBeforeAllowedPassed[slot.id];
      const isConcerned = (voteId: string) => isChoiceYes(voteId, slot.id);
      const isAllowedToRegister = (voteId: string) =>
        !isRegisteredOnce[voteId] || timePassed;

      // already registered on a previous slot -> will be in reregistered waiting list
      const unregistered = slot.registered.filter(
        (id) => isConcerned(id) && !isAllowedToRegister(id),
      );
      const toWaitingListReregistered = slot.waitingList.filter(
        (id) => isConcerned(id) && !isAllowedToRegister(id),
      );
      // not registered on a previous slot anymore or time passed -> waiting list
      const toWaitingList = slot.waitingListReregistered.filter(
        (id) => isConcerned(id) && isAllowedToRegister(id),
      );

      slot.registered = slot.registered.filter(
        (id) => !unregistered.includes(id),
      );
      slot.waitingList = [
        ...slot.waitingList.filter(
          (id) => !toWaitingListReregistered.includes(id),
        ),
        ...toWaitingList,
      ];
      slot.waitingListReregistered = [
        ...slot.waitingListReregistered.filter(
          (id) => !toWaitingList.includes(id),
        ),
        ...unregistered,
        ...toWaitingListReregistered,
      ];

      slot.registered.forEach((id) => {
        if (isConcerned(id)) isRegisteredOnce[id] = true;
      });
    }
  };

  // register the first of the waiting list on the first slot which has room
  const registerFirstWaiting = () => {
    for (const slot of slots) {
      if (slot.registered.length >= slot.maxParticipants) continue;

      const voteId = slot.waitingList.find((id) => isChoiceYes(id, slot.id));
      if (!voteId) continue;

      slot.waitingList = slot.waitingList.filter((id) => id !== voteId);
      slot.registered.push(voteId);
      return true;
    }
    return false;
  };

  // each registration moves someone to an earlier slot so it always ends,
  // the limit is only a safety net
  const maxIterations =
    slots.length *
      slots.reduce((sum, slot) => sum + Math.max(slot.maxParticipants, 0), 0) +
    1;

  for (let i = 0; i < maxIterations; i++) {
    moveToRightArrays();
    if (!registerFirstWaiting()) break;
  }

  // someone can leave a waiting list and come back to it during the loop,
  // they must not lose their place
  for (const slot of slots) {
    for (const key of ["waitingList", "waitingListReregistered"] as const) {
      const kept = initialWaitingLists[slot.id][key].filter((id) =>
        slot[key].includes(id),
      );
      slot[key] = [...kept, ...slot[key].filter((id) => !kept.includes(id))];
    }
  }

  return slots;
};

// removes the deleted votes and, if there were some, applies the registration
// rules again so their spots go to the first of the waiting lists
export const repairDeletedVotes = <T extends SlotArrays>({
  slots,
  votes,
  timeBeforeAllowedPassed,
}: {
  slots: T[];
  votes: { id: string; choices: { slotId: string; choice: number }[] }[];
  timeBeforeAllowedPassed: Record<string, boolean>;
}) => {
  const isRemoved = removeDeletedVotes({
    slots,
    voteIds: votes.map((vote) => vote.id),
  });
  if (isRemoved) {
    reconcileSlotsArrays({
      slots,
      choicesByVoteId: getChoicesByVoteId(votes),
      timeBeforeAllowedPassed,
    });
  }
  return slots;
};

// reregistered people can be registered from this date
// (can't be reregistered on first slot, so no cron schedule for it)
export const getCronSchedulesData = ({
  pollId,
  timeBeforeAllowedType,
  msBeforeAllowed,
  slots,
}: {
  pollId: string;
  timeBeforeAllowedType: number;
  msBeforeAllowed: number;
  slots: { id: string; startDate: Date | string }[];
}) => {
  return [...slots].sort(compareSlots).reduce(
    (arr, curr, index) => {
      // can't be reregistered on first slot
      if (index === 0) return arr;

      // if slot's startDate is before now, don't create cron schedule
      if (new Date(curr.startDate).getTime() < Date.now()) return arr;

      // day before at 5pm
      if (timeBeforeAllowedType == 1) {
        // gen date at 5PM france time
        const cronDateFr = toZonedTime(curr.startDate, "Europe/Paris");
        cronDateFr.setDate(cronDateFr.getDate() - 1);
        cronDateFr.setHours(17, 0, 0, 0);

        const cronDateUtc = fromZonedTime(cronDateFr, "Europe/Paris");
        arr.push({ pollId, slotId: curr.id, schedule: cronDateUtc });
      }
      // specific hours number before startDate
      else {
        const timeBeforeDate = new Date(
          new Date(curr.startDate).getTime() - msBeforeAllowed,
        );
        arr.push({ pollId, slotId: curr.id, schedule: timeBeforeDate });
      }

      return arr;
    },
    [] as { pollId: string; slotId: string; schedule: Date }[],
  );
};
