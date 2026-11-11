import { startOfMonth } from 'date-fns';
import { useEffect, useSyncExternalStore } from 'react';

import { type DateKey, toDateKey } from '@/lib/dates';

/** First day of the earliest month the calendar shows, and of the month in view. */
export type CalendarPosition = { first: DateKey | null; visible: DateKey };

// Module state for the same reason as useJournalFilter: the jump sheet is its own route.
let position: CalendarPosition = { first: null, visible: toDateKey(startOfMonth(new Date())) };
const listeners = new Set<() => void>();

export function setCalendarPosition(change: Partial<CalendarPosition>) {
  const next = { ...position, ...change };
  // Called on every scroll event, so skip re-rendering when the month has not changed.
  if (next.first === position.first && next.visible === position.visible) return;
  position = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useCalendarPosition(): CalendarPosition {
  return useSyncExternalStore(subscribe, () => position);
}

let jumpHandler: ((month: DateKey) => void) | null = null;

/** Scrolls the calendar to `month`. A no-op if the calendar is not mounted. */
export function jumpCalendarTo(month: DateKey) {
  jumpHandler?.(month);
}

/** Registers the calendar screen as the target of `jumpCalendarTo`. */
export function useCalendarJumpHandler(handler: (month: DateKey) => void) {
  useEffect(() => {
    jumpHandler = handler;
    return () => {
      if (jumpHandler === handler) jumpHandler = null;
    };
  }, [handler]);
}
