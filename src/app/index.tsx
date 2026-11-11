import { differenceInCalendarMonths, format, min, startOfMonth, subYears } from 'date-fns';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { MonthGrid, monthHeight } from '@/components/MonthGrid';
import { type DaySummary, getDaySummaries } from '@/db/journal';
import {
  setCalendarPosition,
  useCalendarJumpHandler,
  useCalendarPosition,
} from '@/hooks/useCalendarPosition';
import { type DateKey, monthsBetween, parseDateKey, toDateKey, WEEKDAY_LABELS } from '@/lib/dates';

const SIDE_PADDING = 16;
const GAP = 6;
// How far back the calendar reaches before you have written anything older.
const YEARS_BACK = 10;

export default function CalendarScreen() {
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const [summaries, setSummaries] = useState<Map<DateKey, DaySummary> | null>(null);
  const [today] = useState(() => new Date());
  const listRef = useRef<FlatList<Date>>(null);
  const { visible } = useCalendarPosition();

  // Reload on focus so the calendar reflects whatever was just edited on the day screen.
  useFocusEffect(
    useCallback(() => {
      getDaySummaries(db).then(setSummaries);
    }, [db]),
  );

  const cellSize = Math.floor((width - SIDE_PADDING * 2 - GAP * 6) / 7);

  const months = useMemo(() => {
    if (!summaries) return [];
    const written = [...summaries.keys()].flatMap((key) => parseDateKey(key) ?? []);
    const start = min([startOfMonth(subYears(today, YEARS_BACK)), ...written]);
    return monthsBetween(start, today);
  }, [summaries, today]);

  const offsets = useMemo(() => {
    let offset = 0;
    return months.map((month) => {
      const length = monthHeight(month, cellSize, GAP);
      const layout = { length, offset };
      offset += length;
      return layout;
    });
  }, [months, cellSize]);

  useEffect(() => {
    if (months.length > 0) setCalendarPosition({ first: toDateKey(months[0]) });
  }, [months]);

  // The month in view is the one under the middle of the screen. At either end of the list the
  // middle can sit in a neighbouring month, so the first and last months win there.
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
      const top = contentOffset.y;
      let index: number;
      if (top + layoutMeasurement.height >= contentSize.height - 1) {
        index = months.length - 1;
      } else if (top <= 0) {
        index = 0;
      } else {
        const middle = top + layoutMeasurement.height / 2;
        index = offsets.findIndex((layout) => middle < layout.offset + layout.length);
        if (index === -1) index = months.length - 1;
      }
      if (months[index]) setCalendarPosition({ visible: toDateKey(months[index]) });
    },
    [months, offsets],
  );

  const jumpTo = useCallback(
    (key: DateKey) => {
      const month = parseDateKey(key);
      if (!month || months.length === 0) return;
      const offset = differenceInCalendarMonths(month, months[0]);
      const index = Math.max(0, Math.min(offset, months.length - 1));
      listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: false });
    },
    [months],
  );
  useCalendarJumpHandler(jumpTo);

  const openDay = useCallback((date: DateKey) => {
    router.push({ pathname: '/day/[date]', params: { date } });
  }, []);

  const visibleMonth = parseDateKey(visible);
  const visibleLabel = visibleMonth ? format(visibleMonth, 'MMMM yyyy') : visible;

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center justify-between px-4 py-2">
        <Pressable
          onPress={() => router.push('/calendar-jump')}
          accessibilityRole="button"
          accessibilityLabel={`Showing ${visibleLabel}. Jump to month`}
          className="rounded-full border border-slate-200 px-3 py-1.5 active:bg-slate-100"
        >
          <Text className="text-sm font-medium text-slate-800">{visibleLabel} ▾</Text>
        </Pressable>
        <Pressable
          onPress={() => listRef.current?.scrollToEnd({ animated: true })}
          accessibilityRole="button"
          accessibilityLabel="Jump to today"
          hitSlop={8}
          className="rounded-full px-3 py-1.5 active:bg-slate-100"
        >
          <Text className="text-sm text-slate-600">Today</Text>
        </Pressable>
      </View>

      <View
        className="flex-row border-b border-slate-100 py-2"
        style={{ paddingHorizontal: SIDE_PADDING, gap: GAP }}
      >
        {WEEKDAY_LABELS.map((label, i) => (
          <Text key={i} style={{ width: cellSize }} className="text-center text-xs text-slate-400">
            {label}
          </Text>
        ))}
      </View>

      {/* Render only once data has loaded: initialScrollIndex is read on mount only. */}
      {summaries && (
        <FlatList
          ref={listRef}
          data={months}
          keyExtractor={(month) => month.toISOString()}
          renderItem={({ item }) => (
            <MonthGrid
              month={item}
              cellSize={cellSize}
              gap={GAP}
              today={today}
              summaries={summaries}
              onPressDay={openDay}
            />
          )}
          getItemLayout={(_, index) => ({ ...offsets[index], index })}
          initialScrollIndex={months.length - 1}
          onScroll={onScroll}
          scrollEventThrottle={100}
          contentContainerStyle={{ paddingHorizontal: SIDE_PADDING }}
        />
      )}
    </View>
  );
}
