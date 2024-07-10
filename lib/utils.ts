import { type ClassValue, clsx } from "clsx";
import { format } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { fr } from "date-fns/locale";
import { twMerge } from "tailwind-merge";

import { PollWithSlots } from "./api/vote/mutation";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const sameDay = (d1: Date, d2: Date) => {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

export const getDate = (date: Date) => {
  return format(new Date(date), "EEEE dd/MM", { locale: fr });
};

export const timeTwoDigit = (date: Date) => {
  return format(new Date(date), "HH:mm", { locale: fr });
};

export const getFormattedTimeBeforeAllowed = ({
  timeBeforeAllowedType,
  msBeforeAllowed,
}: {
  timeBeforeAllowedType: number;
  msBeforeAllowed: number;
}) => {
  if (timeBeforeAllowedType === 2) {
    return `${msBeforeAllowed / 60 / 60 / 1000}h avant le début du créneau`;
  } else return "la veille à 17h";
};

export function handleServerResponse<S extends any, Data>(
  response: ApiResponse<S, Data>,
): Data {
  if (response.serverError) {
    throw new Error(response.serverError);
  }

  if (response.validationErrors) {
    console.log(response.validationErrors, "validationErrors");
  }

  if (response.data) {
    if (response.data.success === false) {
      throw new Error(response.data.message ?? "An error occurred.");
    }
    return response.data;
  }

  // Handle case where no data is present
  throw new Error("No data available in the response.");
}

export const checkTimeBeforeAllow = ({
  timeBeforeAllowedType,
  msBeforeAllowed,
  slots,
}: {
  timeBeforeAllowedType: number;
  msBeforeAllowed: number;
  slots: PollWithSlots["slots"];
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
