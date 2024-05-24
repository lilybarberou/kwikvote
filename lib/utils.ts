import { type ClassValue, clsx } from 'clsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const sameDay = (d1: Date, d2: Date) => {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
};

export const getDate = (date: Date) => {
  return format(new Date(date), 'eee dd/MM', { locale: fr });
};

export const timeTwoDigit = (date: Date) => {
  return format(new Date(date), 'HH:mm', { locale: fr });
};

export const getFormattedTimeBeforeAllowed = ({ timeBeforeAllowedType, msBeforeAllowed }: { timeBeforeAllowedType: number; msBeforeAllowed: number }) => {
  if (timeBeforeAllowedType === 2) {
    return `${msBeforeAllowed / 60 / 60 / 1000}h avant le début du créneau`;
  } else return 'la veille à 17h';
};
