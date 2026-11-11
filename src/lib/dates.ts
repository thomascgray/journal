import { addDays, addMonths, format, isValid, parse, startOfDay, startOfMonth } from 'date-fns';

// Days are stored as local calendar dates, never as timestamps, so an entry stays on the
// day it was written for even if the phone's timezone changes later.
export type DateKey = string;

const KEY_FORMAT = 'yyyy-MM-dd';

export function toDateKey(date: Date): DateKey {
  return format(date, KEY_FORMAT);
}

export function parseDateKey(key: string): Date | null {
  const date = parse(key, KEY_FORMAT, new Date());
  return isValid(date) ? date : null;
}

// Weeks start on Monday: 0 is Monday, 6 is Sunday.
export function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** First day of every month from `start` to `end`, inclusive. */
export function monthsBetween(start: Date, end: Date): Date[] {
  const months: Date[] = [];
  for (let m = startOfMonth(start); m <= end; m = addMonths(m, 1)) {
    months.push(m);
  }
  return months;
}

/** Local midnight to the next local midnight, in ms. addDays keeps DST days correct. */
export function dayBounds(date: Date): { start: number; end: number } {
  const start = startOfDay(date);
  return { start: start.getTime(), end: addDays(start, 1).getTime() };
}
