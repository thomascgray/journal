import { useSyncExternalStore } from 'react';

import type { Tag } from '@/db/tags';
import type { JournalRange, SortOrder } from '@/lib/journalRange';

/** When `tag` is set the journal shows every day with that tag, and `range` is ignored. */
export type JournalFilter = { range: JournalRange; tag: Tag | null; order: SortOrder };

// Module state rather than route params: the filter sheet is its own route and has to hand the
// choice back to the journal screen. It lasts until the app is closed.
let filter: JournalFilter = { range: { kind: 'last30Days' }, tag: null, order: 'oldest' };
const listeners = new Set<() => void>();

export function setJournalFilter(change: Partial<JournalFilter>) {
  filter = { ...filter, ...change };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useJournalFilter(): JournalFilter {
  return useSyncExternalStore(subscribe, () => filter);
}
