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
