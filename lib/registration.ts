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
