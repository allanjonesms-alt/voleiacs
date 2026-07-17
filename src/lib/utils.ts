import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getLocalDate(dateInput: number | undefined | null): Date {
  if (!dateInput) return new Date();
  const date = new Date(dateInput);
  // UTC date-only timestamps (midnight UTC) are exact multiples of a day in ms
  if (dateInput % 86400000 === 0) {
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth();
    const d = date.getUTCDate();
    return new Date(y, m, d, 12, 0, 0); // Use 12:00 PM (noon) local time to prevent day shifts
  }
  return date;
}
