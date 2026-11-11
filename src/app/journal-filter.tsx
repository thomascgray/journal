import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { RangeOptions } from '@/components/JournalFilters';
import { getAllTags, type TagUsage } from '@/db/tags';
import { setJournalFilter, useJournalFilter } from '@/hooks/useJournalFilter';

/** Presented as a bottom sheet over the journal screen; see `_layout.tsx`. */
export default function JournalFilterSheet() {
  const db = useSQLiteContext();
  const { range, tag } = useJournalFilter();
  const [today] = useState(() => new Date());
  const [tags, setTags] = useState<TagUsage[]>([]);

  useEffect(() => {
    getAllTags(db)
      .then(setTags)
      .catch((error) => console.warn('Loading tags failed', error));
  }, [db]);

  return (
    <RangeOptions
      range={range}
      tag={tag}
      tags={tags}
      today={today}
      onSelect={(next) => {
        // Picking dates turns the tag filter off.
        setJournalFilter({ range: next, tag: null });
        router.back();
      }}
      onSelectTag={(next) => {
        setJournalFilter({ tag: next });
        router.back();
      }}
    />
  );
}
