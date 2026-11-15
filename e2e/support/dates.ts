// Calendar days of the slots, in Paris time (the app's time zone), relative
// to the day the tests run.

export type Day = { year: number; month: number; day: number };

const parisToday = (): Day => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [year, month, day] = parts.split("-").map(Number);
  return { year, month, day };
};

const toUtcDate = ({ year, month, day }: Day) =>
  new Date(Date.UTC(year, month - 1, day));
const fromUtcDate = (date: Date): Day => ({
  year: date.getUTCFullYear(),
  month: date.getUTCMonth() + 1,
  day: date.getUTCDate(),
});

export const today = parisToday;

export const addDays = (from: Day, days: number): Day => {
  const date = toUtcDate(from);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtcDate(date);
};

// the first given weekday (0 = sunday … 6 = saturday) at least minDaysAhead
// days from today
export const nextWeekday = (weekday: number, minDaysAhead: number): Day => {
  let day = addDays(today(), minDaysAhead);
  while (toUtcDate(day).getUTCDay() !== weekday) day = addDays(day, 1);
  return day;
};

export const monthsBetween = (from: Day, to: Day) =>
  (to.year - from.year) * 12 + (to.month - from.month);

const format = (day: Day, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", ...options }).format(
    toUtcDate(day),
  );

// how the poll pages show a slot day: "vendredi 20/11"
export const slotDayLabel = (day: Day) =>
  `${format(day, { weekday: "long" })} ${format(day, { day: "2-digit" })}/${format(day, { month: "2-digit" })}`;

// the month shown by the calendar: "novembre 2026"
export const calendarMonthLabel = (day: Day) =>
  format(day, { month: "long", year: "numeric" });

export const FRENCH_MONTHS = Array.from({ length: 12 }, (_, month) =>
  format({ year: 2026, month: month + 1, day: 1 }, { month: "long" }),
);
