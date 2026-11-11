import { addDays, format, getDaysInMonth, isAfter } from 'date-fns';
import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { DaySummary } from '@/db/journal';
import { type DateKey, toDateKey, weekdayIndex } from '@/lib/dates';

export const MONTH_HEADER_HEIGHT = 44;
export const MONTH_BOTTOM_SPACING = 24;

/** Exact pixel height of one month, so FlatList can jump to any month without measuring. */
export function monthHeight(month: Date, cellSize: number, gap: number): number {
  const rows = Math.ceil((weekdayIndex(month) + getDaysInMonth(month)) / 7);
  return MONTH_HEADER_HEIGHT + rows * cellSize + (rows - 1) * gap + MONTH_BOTTOM_SPACING;
}

type Props = {
  month: Date;
  cellSize: number;
  gap: number;
  today: Date;
  summaries: Map<DateKey, DaySummary>;
  onPressDay: (date: DateKey) => void;
};

export const MonthGrid = memo(function MonthGrid({
  month,
  cellSize,
  gap,
  today,
  summaries,
  onPressDay,
}: Props) {
  const leadingBlanks = weekdayIndex(month);
  const days = Array.from({ length: getDaysInMonth(month) }, (_, i) => addDays(month, i));
  const todayKey = toDateKey(today);

  return (
    <View style={{ height: monthHeight(month, cellSize, gap) }}>
      <View style={{ height: MONTH_HEADER_HEIGHT }} className="justify-center">
        <Text className="text-lg font-semibold text-slate-800">{format(month, 'MMMM yyyy')}</Text>
      </View>
      <View className="flex-row flex-wrap" style={{ gap }}>
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <View key={`blank-${i}`} style={{ width: cellSize, height: cellSize }} />
        ))}
        {days.map((day) => {
          const key = toDateKey(day);
          return (
            <DayCell
              key={key}
              day={day}
              size={cellSize}
              summary={summaries.get(key)}
              isToday={key === todayKey}
              isFuture={isAfter(day, today)}
              onPress={() => onPressDay(key)}
            />
          );
        })}
      </View>
    </View>
  );
});

type DayCellProps = {
  day: Date;
  size: number;
  summary: DaySummary | undefined;
  isToday: boolean;
  isFuture: boolean;
  onPress: () => void;
};

function DayCell({ day, size, summary, isToday, isFuture, onPress }: DayCellProps) {
  const cover = summary?.coverUri;
  const border = isToday ? 'border-2 border-slate-900' : 'border border-slate-200';
  const background = summary ? 'bg-amber-100' : 'bg-white';

  return (
    <Pressable
      onPress={onPress}
      disabled={isFuture}
      accessibilityRole="button"
      accessibilityLabel={format(day, 'EEEE d MMMM yyyy')}
      style={{ width: size, height: size }}
      className={`overflow-hidden rounded-lg ${border} ${background} ${isFuture ? 'opacity-40' : ''}`}
    >
      {cover && (
        <Image
          source={{ uri: cover }}
          recyclingKey={cover}
          contentFit="cover"
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        />
      )}
      <Text
        className={`ml-1 mt-0.5 text-xs ${cover ? 'font-semibold text-white' : 'text-slate-600'}`}
        style={cover ? { textShadowColor: '#000a', textShadowRadius: 3 } : undefined}
      >
        {format(day, 'd')}
      </Text>
    </Pressable>
  );
}
