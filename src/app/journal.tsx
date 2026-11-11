import { format } from 'date-fns';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Text, useWindowDimensions, View } from 'react-native';

import { Markdown } from '@/components/Markdown';
import { JournalFilterBar } from '@/components/JournalFilters';
import { Masonry } from '@/components/Masonry';
import { TagList } from '@/components/Tags';
import { getJournalDays, type JournalDay, type JournalQuery } from '@/db/journal';
import { setJournalFilter, useJournalFilter } from '@/hooks/useJournalFilter';
import { parseDateKey } from '@/lib/dates';
import { rangeBounds } from '@/lib/journalRange';

const SIDE_PADDING = 16;

export default function JournalScreen() {
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const [days, setDays] = useState<JournalDay[] | null>(null);
  const [today] = useState(() => new Date());
  const { range, tag, order } = useJournalFilter();
  const query = useMemo<JournalQuery>(
    () =>
      tag ? { kind: 'tag', tagId: tag.id } : { kind: 'dates', bounds: rangeBounds(range, today) },
    [range, tag, today],
  );

  // Reload on focus so edits made on the day screen show up on return, and whenever the filter
  // changes. The flag drops a slow earlier query that finishes after a newer one.
  useFocusEffect(
    useCallback(() => {
      let current = true;
      getJournalDays(db, query, order).then((result) => current && setDays(result));
      return () => {
        current = false;
      };
    }, [db, query, order]),
  );

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ title: 'Journal' }} />
      <JournalFilterBar
        range={range}
        tag={tag}
        order={order}
        onChangeOrder={(next) => setJournalFilter({ order: next })}
      />
      {days && (
        <FlatList
          data={days}
          keyExtractor={(day) => day.date}
          renderItem={({ item }) => <DayCard day={item} width={width - SIDE_PADDING * 2} />}
          ItemSeparatorComponent={() => <View className="my-6 h-px bg-slate-100" />}
          contentContainerStyle={{ padding: SIDE_PADDING, paddingBottom: 48 }}
          ListEmptyComponent={
            <Text className="mt-8 text-center text-slate-500">
              {tag
                ? `No days are tagged ${tag.name}.`
                : 'Nothing written for these dates. Tap a day in the calendar to start.'}
            </Text>
          }
        />
      )}
    </View>
  );
}

// Read-only. Editing happens from the calendar; tapping the gallery opens the full-size viewer.
function DayCard({ day, width }: { day: JournalDay; width: number }) {
  const date = parseDateKey(day.date);
  const openGallery = useCallback(
    (index: number) =>
      router.push({ pathname: '/gallery/[date]', params: { date: day.date, index } }),
    [day.date],
  );

  return (
    <View className="gap-3">
      <Text className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {date ? format(date, 'EEEE d MMMM yyyy') : day.date}
      </Text>
      <TagList tags={day.tags} />
      {day.body.trim() !== '' && <Markdown source={day.body} />}
      {day.attachments.length > 0 && (
        <Masonry attachments={day.attachments} width={width} onPress={openGallery} />
      )}
    </View>
  );
}
