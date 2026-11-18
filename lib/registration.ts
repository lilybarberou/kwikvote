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

// priority: only for a yes in a registration poll (see normalizeChoices)
export type RegistrationChoice = {
  slotId: string;
  choice: number;
  priority?: boolean;
};
export type ChoicesByVoteId = Record<string, RegistrationChoice[]>;

/**
 * Order in which the slots of a vote are considered: the slots it said yes to
 * and marked as priority come first, then the other ones, each group in the
 * slots order. Without priority, it is the slots order.
 * `slots` must be sorted like `slotsOrderBy`.
 */
export const getSlotsInVoteOrder = <T extends { id: string }>(
  slots: T[],
  choices: RegistrationChoice[] | undefined,
) => {
  const prioritySlotIds = new Set(
    (choices ?? [])
      .filter((choice) => choice.priority && choice.choice === 1)
      .map((choice) => choice.slotId),
  );
  if (!prioritySlotIds.size) return slots;

  return [
    ...slots.filter((slot) => prioritySlotIds.has(slot.id)),
    ...slots.filter((slot) => !prioritySlotIds.has(slot.id)),
  ];
};

/**
 * Choices as they must be stored: a priority only makes sense on a yes of a
 * registration poll. A choice sent without priority (client of a previous
 * version) keeps the stored one.
 */
export const normalizeChoices = <
  T extends { slotId: string; choice: number; priority?: boolean },
>({
  choices,
  storedChoices,
  pollType,
}: {
  choices: T[];
  storedChoices?: RegistrationChoice[];
  pollType: number;
}) =>
  choices.map((choice) => {
    const priority =
      choice.priority ??
      storedChoices?.find((stored) => stored.slotId === choice.slotId)
        ?.priority ??
      false;
    return {
      ...choice,
      priority: pollType === 2 && choice.choice === 1 && priority,
    };
  });

export const getChoicesByVoteId = (
  votes: { id: string; choices: RegistrationChoice[] }[],
): ChoicesByVoteId =>
  Object.fromEntries(votes.map((vote) => [vote.id, vote.choices]));

const isChoiceYesOn = (
  choicesByVoteId: ChoicesByVoteId,
  voteId: string,
  slotId: string,
) =>
  choicesByVoteId[voteId]?.find((choice) => choice.slotId === slotId)
    ?.choice === 1;

/**
 * Re-applies the registration rules on all the slots of a poll, after their
 * order or their reregistration time changed (slot dates update) or a slot
 * was deleted.
 *
 * Same rules as the votes cascade (placeVote), each vote going through its
 * slots in its own order (getSlotsInVoteOrder: priority slots first):
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
  choicesByVoteId: ChoicesByVoteId;
  timeBeforeAllowedPassed: Record<string, boolean>;
}) => {
  const isChoiceYes = (voteId: string, slotId: string) =>
    isChoiceYesOn(choicesByVoteId, voteId, slotId);

  const initialWaitingLists = Object.fromEntries(
    slots.map((slot) => [
      slot.id,
      {
        waitingList: [...slot.waitingList],
        waitingListReregistered: [...slot.waitingListReregistered],
      },
    ]),
  );

  // put everyone in the right array according to its slots order
  const moveToRightArrays = () => {
    // registered on a slot coming before in the vote's order, once the
    // registrations not allowed are removed (they only depend on the vote)
    const isRegisteredBefore: Record<string, Record<string, boolean>> = {};
    const voteIds = slots.flatMap((slot) => [
      ...slot.registered,
      ...slot.waitingList,
      ...slot.waitingListReregistered,
    ]);
    for (const voteId of voteIds) {
      if (isRegisteredBefore[voteId]) continue;
      let isRegisteredOnce = false;
      isRegisteredBefore[voteId] = {};

      for (const slot of getSlotsInVoteOrder(slots, choicesByVoteId[voteId])) {
        isRegisteredBefore[voteId][slot.id] = isRegisteredOnce;
        if (
          slot.registered.includes(voteId) &&
          isChoiceYes(voteId, slot.id) &&
          (!isRegisteredOnce || timeBeforeAllowedPassed[slot.id])
        )
          isRegisteredOnce = true;
      }
    }

    for (const slot of slots) {
      const timePassed = timeBeforeAllowedPassed[slot.id];
      const isConcerned = (voteId: string) => isChoiceYes(voteId, slot.id);
      const isAllowedToRegister = (voteId: string) =>
        !isRegisteredBefore[voteId]?.[slot.id] || timePassed;

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

  // each registration moves someone to an earlier slot (in its order) so it
  // always ends, the limit is only a safety net
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
  votes: { id: string; choices: RegistrationChoice[] }[];
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

const removeVoteFromSlot = (slot: SlotArrays, voteId: string) => {
  slot.registered = slot.registered.filter((id) => id !== voteId);
  slot.waitingList = slot.waitingList.filter((id) => id !== voteId);
  slot.waitingListReregistered = slot.waitingListReregistered.filter(
    (id) => id !== voteId,
  );
  slot.notComing = slot.notComing.filter((id) => id !== voteId);
};

/**
 * Puts one vote in the right arrays of every slot, same rules as
 * `reconcileSlotsArrays`: its slots are gone through in its own order
 * (priority slots first), it is registered on the first one which has room.
 * `slots` are updated in place.
 *
 * - `oldChoices`: the stored choices when the author edits the vote, the slots
 *   whose choice changed are emptied of the vote and handled like a new vote
 *   (the vote goes to the end of the arrays)
 * - `voteExists`: the vote is already in the arrays (edit or cascade), it keeps
 *   its place in the arrays it stays in
 */
export const placeVote = <T extends SlotArrays>({
  slots,
  voteId,
  choices,
  oldChoices,
  voteExists,
  timeBeforeAllowedPassed,
}: {
  slots: T[];
  voteId: string;
  choices: RegistrationChoice[];
  oldChoices?: RegistrationChoice[];
  voteExists: boolean;
  timeBeforeAllowedPassed: Record<string, boolean>;
}) => {
  let isRegisteredOnce = false;

  for (const slot of getSlotsInVoteOrder(slots, choices)) {
    const timePassed = timeBeforeAllowedPassed[slot.id];
    const currentVoteChoice = choices.find(
      (choice) => choice.slotId === slot.id,
    );
    const isChoiceNo = currentVoteChoice?.choice == 2;

    const isAllowedToRegister = () => !isRegisteredOnce || timePassed;
    const isFull = () => slot.registered.length >= slot.maxParticipants;

    if (voteExists) {
      const choiceChanged = oldChoices
        ? oldChoices.find((choice) => choice.slotId === slot.id)?.choice !==
          currentVoteChoice?.choice
        : false;

      if (choiceChanged) removeVoteFromSlot(slot, voteId);
      else {
        // no changes if still no
        if (currentVoteChoice?.choice != 1) continue;

        const isRegistered = slot.registered.includes(voteId);

        // first slot where it is registered, it stays registered
        if (isRegistered && !isRegisteredOnce) {
          isRegisteredOnce = true;
          continue;
        }
        // already registered on a previous slot
        else if (isRegistered && isRegisteredOnce) {
          // reregistration allowed, it can stay
          if (timePassed) {
            isRegisteredOnce = true;
            continue;
          }
          // else removed from registered (will be in reregistered waiting list)
          else slot.registered = slot.registered.filter((id) => id !== voteId);
        }
        // not registered yet -> actually in wl or wlr
        else {
          const isWaitingList = slot.waitingList.includes(voteId);
          const isWaitingListReregistered =
            slot.waitingListReregistered.includes(voteId);

          if (isFull()) {
            // if allowed to reregister -> must be in wl
            if (isAllowedToRegister()) {
              if (isWaitingListReregistered)
                slot.waitingListReregistered =
                  slot.waitingListReregistered.filter((id) => id !== voteId);
              else continue;
            }
            // else -> must be in wlr
            else {
              if (isWaitingList)
                slot.waitingList = slot.waitingList.filter(
                  (id) => id !== voteId,
                );
              else continue;
            }
          } else {
            // if allowed to reregister -> remove from all wl -> will be in registered
            if (isAllowedToRegister()) {
              slot.waitingListReregistered =
                slot.waitingListReregistered.filter((id) => id !== voteId);
              slot.waitingList = slot.waitingList.filter((id) => id !== voteId);
            }
            // else -> must be in wlr
            else {
              if (isWaitingList)
                slot.waitingList = slot.waitingList.filter(
                  (id) => id !== voteId,
                );
              else continue;
            }
          }
        }
      }
    }

    if (isChoiceNo) slot.notComing.push(voteId);
    else {
      // not full -> add to registered
      if (!isFull() && isAllowedToRegister()) {
        slot.registered.push(voteId);
        isRegisteredOnce = true;
      }
      // full and not registered anywhere -> add to waiting list
      else if (isAllowedToRegister()) slot.waitingList.push(voteId);
      // already registered somewhere -> add to reregistered waiting list
      else slot.waitingListReregistered.push(voteId);
    }
  }

  return slots;
};

// each step of a cascade takes someone out of a waiting list, the limit is
// only a safety net against inconsistent data: the transaction is cancelled
// instead of looping until its timeout
const getMaxCascadeSteps = (slots: SlotArrays[]) =>
  (slots.reduce(
    (sum, slot) =>
      sum + slot.waitingList.length + slot.waitingListReregistered.length,
    0,
  ) +
    1) *
  (slots.length + 1);

const cascadeError = () =>
  new Error("Registration cascade did not end, slots arrays are inconsistent");

/**
 * While a slot has room and people in its waiting list, the first of them is
 * placed again (gets registered, which can free a spot on another slot).
 * Used after a vote is created, edited or deleted.
 */
export const fillFreeSpots = <T extends SlotArrays>({
  slots,
  choicesByVoteId,
  timeBeforeAllowedPassed,
}: {
  slots: T[];
  choicesByVoteId: ChoicesByVoteId;
  timeBeforeAllowedPassed: Record<string, boolean>;
}) => {
  const maxSteps = getMaxCascadeSteps(slots);

  for (let step = 0; ; step++) {
    // first of the waiting list of the last slot which has room
    let voteIdToRegister = "";
    slots.forEach((slot) => {
      const isNotFull = slot.registered.length < slot.maxParticipants;
      if (isNotFull && slot.waitingList.length > 0)
        voteIdToRegister = slot.waitingList[0];
    });
    if (!voteIdToRegister) return slots;
    if (step >= maxSteps) throw cascadeError();

    placeVote({
      slots,
      voteId: voteIdToRegister,
      choices: choicesByVoteId[voteIdToRegister] ?? [],
      voteExists: true,
      timeBeforeAllowedPassed,
    });
  }
};

/**
 * What the cron does once the reregistration time of slots has passed:
 * - while a slot whose time has passed has room, the first of its
 *   reregistered waiting list (on the last such slot) is placed again, in
 *   its own order (priority slots first);
 * - then the reregistered people of these slots join the end of their
 *   waiting list;
 * - and the free spots go to the waiting lists (fillFreeSpots): a vote
 *   placed again can free a spot on a slot whose time hasn't passed.
 * The votes missing from choicesByVoteId (deleted) are skipped.
 * `slots` must be sorted like `slotsOrderBy`, they are updated in place.
 */
export const openReregistrations = <T extends SlotArrays>({
  slots,
  choicesByVoteId,
  timeBeforeAllowedPassed,
}: {
  slots: T[];
  choicesByVoteId: ChoicesByVoteId;
  timeBeforeAllowedPassed: Record<string, boolean>;
}) => {
  const maxSteps = getMaxCascadeSteps(slots);

  for (let step = 0; ; step++) {
    let voteIdToRegister = "";
    slots.forEach((slot) => {
      const isNotFull = slot.registered.length < slot.maxParticipants;
      const firstReregistered = slot.waitingListReregistered.find(
        (id) => id in choicesByVoteId,
      );
      if (isNotFull && timeBeforeAllowedPassed[slot.id] && firstReregistered)
        voteIdToRegister = firstReregistered;
    });
    if (!voteIdToRegister) break;
    if (step >= maxSteps) throw cascadeError();

    placeVote({
      slots,
      voteId: voteIdToRegister,
      choices: choicesByVoteId[voteIdToRegister] ?? [],
      voteExists: true,
      timeBeforeAllowedPassed,
    });
  }

  slots.forEach((slot) => {
    if (!timeBeforeAllowedPassed[slot.id]) return;
    slot.waitingList = [...slot.waitingList, ...slot.waitingListReregistered];
    slot.waitingListReregistered = [];
  });

  return fillFreeSpots({ slots, choicesByVoteId, timeBeforeAllowedPassed });
};

// whether the reregistration time of each slot has passed: the day before at
// 17:00 Paris time (timeBeforeAllowedType 1), or msBeforeAllowed before its start
export const checkTimeBeforeAllow = ({
  timeBeforeAllowedType,
  msBeforeAllowed,
  slots,
}: {
  timeBeforeAllowedType: number;
  msBeforeAllowed: number;
  slots: { id: string; startDate: Date }[];
}) => {
  return slots.reduce(
    (obj, curr) => {
      const now = new Date();

      // date to compare is day before at 5pm
      if (timeBeforeAllowedType == 1) {
        const dateToCompareFr = toZonedTime(curr.startDate, "Europe/Paris");
        dateToCompareFr.setDate(dateToCompareFr.getDate() - 1);
        dateToCompareFr.setHours(17, 0, 0, 0);
        const dateToCompareUtc = fromZonedTime(dateToCompareFr, "Europe/Paris");

        obj[curr.id] = now.getTime() > dateToCompareUtc.getTime();
      }
      // specific hours number before startDate
      else {
        obj[curr.id] =
          now.getTime() > curr.startDate.getTime() - msBeforeAllowed;
      }
      return obj;
    },
    {} as Record<string, boolean>,
  );
};

/**
 * Places a vote just created or edited by its author (`oldChoices` are its
 * stored choices when it is an edit), then fills the spots it freed.
 * `choicesByVoteId` must hold the choices of the other votes.
 */
export const registerVote = <T extends SlotArrays>({
  slots,
  voteId,
  choices,
  oldChoices,
  choicesByVoteId,
  timeBeforeAllowedPassed,
}: {
  slots: T[];
  voteId: string;
  choices: RegistrationChoice[];
  oldChoices?: RegistrationChoice[];
  choicesByVoteId: ChoicesByVoteId;
  timeBeforeAllowedPassed: Record<string, boolean>;
}) => {
  placeVote({
    slots,
    voteId,
    choices,
    oldChoices,
    voteExists: !!oldChoices,
    timeBeforeAllowedPassed,
  });
  return fillFreeSpots({ slots, choicesByVoteId, timeBeforeAllowedPassed });
};

// reregistered people can be registered from this date
// every slot gets one: with priorities, someone can be reregistered on the
// first slot too (registered on a later priority slot)
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
    (arr, curr) => {
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
