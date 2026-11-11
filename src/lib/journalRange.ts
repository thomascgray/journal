import {
  endOfMonth,
  format,
  isSameDay,
  isSameYear,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns';

import { type DateKey, parseDateKey, toDateKey } from '@/lib/dates';

/** The longest span, in days, that a custom range may cover. */
export const MAX_RANGE_DAYS = 90;

/** Which days the journal view shows. */
export type JournalRange =
  | { kind: 'thisMonth' }
  | { kind: 'lastMonth' }
  | { kind: 'last30Days' }
  | { kind: 'month'; month: DateKey }
  | { kind: 'custom'; start: DateKey; end: DateKey };

export type SortOrder = 'newest' | 'oldest';

/** First and last day of a range, both inclusive. */
export type RangeBounds = { start: DateKey; end: DateKey };

export function rangeBounds(range: JournalRange, today: Date): RangeBounds {
  switch (range.kind) {
    case 'thisMonth':
      return monthBounds(today);
    case 'lastMonth':
      return monthBounds(subMonths(today, 1));
    case 'last30Days':
      return { start: toDateKey(subDays(today, 29)), end: toDateKey(today) };
    case 'month':
      return monthBounds(parseDateKey(range.month) ?? today);
    case 'custom':
      return { start: range.start, end: range.end };
  }
}

function monthBounds(date: Date): RangeBounds {
  return { start: toDateKey(startOfMonth(date)), end: toDateKey(endOfMonth(date)) };
}

export function rangeLabel(range: JournalRange): string {
  switch (range.kind) {
    case 'thisMonth':
      return 'This month';
    case 'lastMonth':
      return 'Last month';
    case 'last30Days':
      return 'Last 30 days';
    case 'month': {
      const month = parseDateKey(range.month);
      return month ? format(month, 'MMMM yyyy') : range.month;
    }
    case 'custom':
      return formatBounds(range);
  }
}

/** "3 Mar to 9 Apr 2026", dropping the first year when both ends share it. */
export function formatBounds({ start, end }: RangeBounds): string {
  const a = parseDateKey(start);
  const b = parseDateKey(end);
  if (!a || !b) return `${start} to ${end}`;
  if (isSameDay(a, b)) return format(a, 'd MMM yyyy');
  const first = format(a, isSameYear(a, b) ? 'd MMM' : 'd MMM yyyy');
  return `${first} to ${format(b, 'd MMM yyyy')}`;
}
