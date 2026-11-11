import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  getDaysInMonth,
  isAfter,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MonthPicker, SubHeader } from '@/components/MonthPicker';
import type { Tag, TagUsage } from '@/db/tags';
import { type DateKey, parseDateKey, toDateKey, WEEKDAY_LABELS, weekdayIndex } from '@/lib/dates';
import {
  formatBounds,
  type JournalRange,
  MAX_RANGE_DAYS,
  rangeBounds,
  rangeLabel,
  type SortOrder,
} from '@/lib/journalRange';
import { tagColors } from '@/lib/tagColor';

const SHEET_PADDING = 16;
const GAP = 4;

type Props = {
  range: JournalRange;
  tag: Tag | null;
  order: SortOrder;
  onChangeOrder: (order: SortOrder) => void;
};

/** The row above the journal list: which days to show, and in which order. */
export function JournalFilterBar({ range, tag, order, onChangeOrder }: Props) {
  const label = tag ? tag.name : rangeLabel(range);
  return (
    <View className="flex-row items-center justify-between border-b border-slate-100 px-4 py-2">
      <Pressable
        onPress={() => router.push('/journal-filter')}
        accessibilityRole="button"
        accessibilityLabel={`Showing ${tag ? `days tagged ${tag.name}` : label}. Change filter`}
        className="flex-row items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 active:bg-slate-100"
      >
        {tag && <TagDot name={tag.name} />}
        <Text className="text-sm font-medium text-slate-800">{label} ▾</Text>
      </Pressable>
      <Pressable
        onPress={() => onChangeOrder(order === 'newest' ? 'oldest' : 'newest')}
        accessibilityRole="button"
        accessibilityLabel={`${order === 'newest' ? 'Newest' : 'Oldest'} first. Reverse order`}
        hitSlop={8}
        className="rounded-full px-3 py-1.5 active:bg-slate-100"
      >
        <Text className="text-sm text-slate-600">
          {order === 'newest' ? 'Newest first ↓' : 'Oldest first ↑'}
        </Text>
      </Pressable>
    </View>
  );
}

function TagDot({ name }: { name: string }) {
  return (
    <View style={{ backgroundColor: tagColors(name).dot }} className="h-2.5 w-2.5 rounded-full" />
  );
}

type SheetProps = {
  range: JournalRange;
  tag: Tag | null;
  tags: TagUsage[];
  today: Date;
  onSelect: (range: JournalRange) => void;
  onSelectTag: (tag: Tag) => void;
};

type SheetView = 'presets' | 'month' | 'custom' | 'tag';

/** Contents of the filter sheet. The sheet itself is the `journal-filter` route. */
export function RangeOptions({ range, tag, tags, today, onSelect, onSelectTag }: SheetProps) {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<SheetView>('presets');

  // In a sub-view, the back button returns to the list instead of closing the sheet.
  useEffect(() => {
    if (view === 'presets') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setView('presets');
      return true;
    });
    return () => subscription.remove();
  }, [view]);

  return (
    <View style={{ padding: SHEET_PADDING, paddingBottom: insets.bottom + SHEET_PADDING }}>
      {view === 'presets' && (
        <Presets
          range={range}
          tag={tag}
          tagCount={tags.length}
          today={today}
          onSelect={onSelect}
          onNavigate={setView}
        />
      )}
      {view === 'month' && (
        <MonthPicker
          selected={range.kind === 'month' ? range.month : null}
          today={today}
          onBack={() => setView('presets')}
          onSelect={(month) => onSelect({ kind: 'month', month })}
        />
      )}
      {view === 'custom' && (
        <DayRangePicker
          range={range}
          today={today}
          onBack={() => setView('presets')}
          onSelect={onSelect}
        />
      )}
      {view === 'tag' && (
        <TagPicker
          tags={tags}
          selected={tag}
          onBack={() => setView('presets')}
          onSelect={onSelectTag}
        />
      )}
    </View>
  );
}

const PRESETS: JournalRange[] = [
  { kind: 'last30Days' },
  { kind: 'thisMonth' },
  { kind: 'lastMonth' },
];

function Presets({
  range,
  tag,
  tagCount,
  today,
  onSelect,
  onNavigate,
}: {
  range: JournalRange;
  tag: Tag | null;
  tagCount: number;
  today: Date;
  onSelect: (range: JournalRange) => void;
  onNavigate: (view: SheetView) => void;
}) {
  return (
    <View>
      <Text className="mb-2 text-base font-semibold text-slate-900">Show entries from</Text>
      {PRESETS.map((preset) => (
        <Row
          key={preset.kind}
          label={rangeLabel(preset)}
          detail={formatBounds(rangeBounds(preset, today))}
          selected={!tag && range.kind === preset.kind}
          onPress={() => onSelect(preset)}
        />
      ))}
      <Row
        label="Choose a month"
        detail={range.kind === 'month' ? rangeLabel(range) : undefined}
        selected={!tag && range.kind === 'month'}
        onPress={() => onNavigate('month')}
        chevron
      />
      <Row
        label="Choose dates"
        detail={
          range.kind === 'custom' ? rangeLabel(range) : `Any span up to ${MAX_RANGE_DAYS} days`
        }
        selected={!tag && range.kind === 'custom'}
        onPress={() => onNavigate('custom')}
        chevron
      />
      <Row
        label="Choose a tag"
        detail={
          tag
            ? tag.name
            : tagCount === 0
              ? 'No tags yet'
              : `${tagCount} tag${tagCount === 1 ? '' : 's'}`
        }
        selected={tag !== null}
        onPress={() => onNavigate('tag')}
        chevron
      />
    </View>
  );
}

function Row({
  label,
  detail,
  selected,
  onPress,
  chevron,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
  chevron?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className="-mx-2 flex-row items-center rounded-lg px-2 py-3 active:bg-slate-100"
    >
      <View className="flex-1">
        <Text
          className={`text-base ${selected ? 'font-semibold text-slate-900' : 'text-slate-800'}`}
        >
          {label}
        </Text>
        {detail && <Text className="text-xs text-slate-500">{detail}</Text>}
      </View>
      {selected && !chevron && <Text className="text-base text-slate-900">✓</Text>}
      {chevron && <Text className="text-lg text-slate-400">›</Text>}
    </Pressable>
  );
}

// Caps the list so a long tag list scrolls inside the sheet instead of growing past the screen.
const TAG_LIST_MAX_HEIGHT = 360;

function TagPicker({
  tags,
  selected,
  onBack,
  onSelect,
}: {
  tags: TagUsage[];
  selected: Tag | null;
  onBack: () => void;
  onSelect: (tag: Tag) => void;
}) {
  return (
    <View>
      <View className="mb-2 flex-row items-center">
        <Pressable onPress={onBack} accessibilityLabel="Back" hitSlop={12} className="mr-3">
          <Text className="text-lg text-slate-500">‹ Back</Text>
        </Pressable>
        <Text className="text-base font-semibold text-slate-900">Days tagged</Text>
      </View>
      {tags.length === 0 ? (
        <Text className="py-3 text-sm text-slate-500">
          No tags yet. Add one from a day in the calendar.
        </Text>
      ) : (
        <ScrollView style={{ maxHeight: TAG_LIST_MAX_HEIGHT }}>
          {tags.map((tag) => {
            const isSelected = selected?.id === tag.id;
            return (
              <Pressable
                key={tag.id}
                onPress={() => onSelect({ id: tag.id, name: tag.name })}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                className="-mx-2 flex-row items-center gap-3 rounded-lg px-2 py-3 active:bg-slate-100"
              >
                <TagDot name={tag.name} />
                <Text
                  className={`flex-1 text-base ${isSelected ? 'font-semibold text-slate-900' : 'text-slate-800'}`}
                >
                  {tag.name}
                </Text>
                <Text className="text-sm text-slate-400">
                  {tag.dayCount} {tag.dayCount === 1 ? 'day' : 'days'}
                </Text>
                {isSelected && <Text className="text-base text-slate-900">✓</Text>}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

/**
 * One month of days. The first tap sets the start, the second sets the end. Once a start is set,
 * days more than MAX_RANGE_DAYS away from it are disabled.
 */
function DayRangePicker({
  range,
  today,
  onBack,
  onSelect,
}: {
  range: JournalRange;
  today: Date;
  onBack: () => void;
  onSelect: (range: JournalRange) => void;
}) {
  const { width } = useWindowDimensions();
  const [start, setStart] = useState<DateKey | null>(range.kind === 'custom' ? range.start : null);
  const [end, setEnd] = useState<DateKey | null>(range.kind === 'custom' ? range.end : null);
  const [month, setMonth] = useState(() =>
    startOfMonth((range.kind === 'custom' && parseDateKey(range.end)) || today),
  );

  const cellSize = Math.floor((width - SHEET_PADDING * 2 - GAP * 6) / 7);
  const startDate = start ? parseDateKey(start) : null;
  const choosingEnd = startDate !== null && end === null;
  const todayKey = toDateKey(today);

  const press = (key: DateKey) => {
    if (!start || end) {
      setStart(key);
      setEnd(null);
    } else if (key < start) {
      setEnd(start);
      setStart(key);
    } else {
      setEnd(key);
    }
  };

  const days = Array.from({ length: getDaysInMonth(month) }, (_, i) => addDays(month, i));

  return (
    <View>
      <SubHeader
        title={format(month, 'MMM yyyy')}
        onBack={onBack}
        onPrev={() => setMonth(subMonths(month, 1))}
        onNext={() => setMonth(addMonths(month, 1))}
        nextDisabled={!isAfter(startOfMonth(today), month)}
      />

      <View className="mb-1 flex-row" style={{ gap: GAP }}>
        {WEEKDAY_LABELS.map((label, i) => (
          <Text key={i} style={{ width: cellSize }} className="text-center text-xs text-slate-400">
            {label}
          </Text>
        ))}
      </View>
      <View className="flex-row flex-wrap" style={{ gap: GAP }}>
        {Array.from({ length: weekdayIndex(month) }, (_, i) => (
          <View key={`blank-${i}`} style={{ width: cellSize, height: cellSize }} />
        ))}
        {days.map((day) => {
          const key = toDateKey(day);
          const isEndpoint = key === start || key === end;
          const isBetween = start !== null && end !== null && key > start && key < end;
          // MAX_RANGE_DAYS counts both ends, so the far end is at most MAX - 1 days away.
          const tooFar =
            choosingEnd &&
            startDate !== null &&
            Math.abs(differenceInCalendarDays(day, startDate)) >= MAX_RANGE_DAYS;
          const disabled = key > todayKey || tooFar;
          return (
            <Pressable
              key={key}
              onPress={() => press(key)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={format(day, 'EEEE d MMMM yyyy')}
              accessibilityState={{ selected: isEndpoint, disabled }}
              style={{ width: cellSize, height: cellSize }}
              className={`items-center justify-center rounded-lg ${
                isEndpoint ? 'bg-slate-900' : isBetween ? 'bg-slate-200' : ''
              } ${disabled ? 'opacity-30' : ''}`}
            >
              <Text className={isEndpoint ? 'font-semibold text-white' : 'text-slate-800'}>
                {format(day, 'd')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="mt-4 flex-row items-center justify-between">
        <Text className="flex-1 text-sm text-slate-500">
          {start
            ? formatBounds({ start, end: end ?? start })
            : `Tap the first day, then the last. Up to ${MAX_RANGE_DAYS} days.`}
        </Text>
        <Pressable
          onPress={() => start && onSelect({ kind: 'custom', start, end: end ?? start })}
          disabled={!start}
          accessibilityRole="button"
          className={`ml-3 rounded-full bg-slate-900 px-5 py-2 ${start ? '' : 'opacity-30'}`}
        >
          <Text className="font-semibold text-white">Show</Text>
        </Pressable>
      </View>
    </View>
  );
}
