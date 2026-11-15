import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// apart from lib/utils.ts: the components that only need cn() no longer
// bring its date-fns and date-fns-tz imports into every page
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
