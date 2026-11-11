import { format, isAfter, isBefore, startOfMonth } from 'date-fns';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { type DateKey, parseDateKey, toDateKey } from '@/lib/dates';

/** Header row for a picker in a sheet: back link or heading on the left, prev/next on the right. */
export function SubHeader({
  title,
  heading,
  onBack,
  onPrev,
  onNext,
  prevDisabled = false,
  nextDisabled,
}: {
  title: string;
  heading?: string;
  onBack?: () => void;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled?: boolean;
  nextDisabled: boolean;
}) {
  return (
    <View className="mb-3 flex-row items-center">
      {onBack && (
        <Pressable onPress={onBack} accessibilityLabel="Back" hitSlop={12} className="mr-3">
          <Text className="text-lg text-slate-500">‹ Back</Text>
        </Pressable>
      )}
      {heading && <Text className="mr-3 text-base font-semibold text-slate-900">{heading}</Text>}
      <View className="flex-1 flex-row items-center justify-end gap-4">
        <Pressable
          onPress={onPrev}
          disabled={prevDisabled}
          accessibilityLabel="Previous"
          hitSlop={12}
          className={prevDisabled ? 'opacity-30' : ''}
        >
          <Text className="px-2 text-xl text-slate-700">‹</Text>
        </Pressable>
        <Text className="min-w-28 text-center text-base font-semibold text-slate-900">{title}</Text>
        <Pressable
          onPress={onNext}
          disabled={nextDisabled}
          accessibilityLabel="Next"
          hitSlop={12}
          className={nextDisabled ? 'opacity-30' : ''}
        >
          <Text className="px-2 text-xl text-slate-700">›</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * A year of months as a 3x4 grid. Months after `today`, and before `earliest` when given, are
 * disabled. `selected` and the value passed to `onSelect` are the first day of the month.
 */
export function MonthPicker({
  selected,
  today,
  earliest,
  heading,
  onBack,
  onSelect,
}: {
  selected: DateKey | null;
  today: Date;
  earliest?: Date;
  heading?: string;
  onBack?: () => void;
  onSelect: (month: DateKey) => void;
}) {
  const [year, setYear] = useState(
    () => (selected && parseDateKey(selected)?.getFullYear()) || today.getFullYear(),
  );
  const thisMonth = startOfMonth(today);
  const firstMonth = earliest && startOfMonth(earliest);

  return (
    <View>
      <SubHeader
        title={String(year)}
        heading={heading}
        onBack={onBack}
        onPrev={() => setYear(year - 1)}
        onNext={() => setYear(year + 1)}
        prevDisabled={firstMonth !== undefined && year <= firstMonth.getFullYear()}
        nextDisabled={year >= today.getFullYear()}
      />
      <View className="flex-row flex-wrap" style={{ rowGap: 8 }}>
        {Array.from({ length: 12 }, (_, i) => {
          const month = new Date(year, i, 1);
          const key = toDateKey(month);
          const isSelected = key === selected;
          const disabled =
            isAfter(month, thisMonth) || (firstMonth !== undefined && isBefore(month, firstMonth));
          return (
            <View key={key} className="w-1/3 px-1">
              <Pressable
                onPress={() => onSelect(key)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={format(month, 'MMMM yyyy')}
                accessibilityState={{ selected: isSelected, disabled }}
                className={`items-center rounded-lg py-3 ${
                  isSelected ? 'bg-slate-900' : 'bg-slate-100 active:bg-slate-200'
                } ${disabled ? 'opacity-30' : ''}`}
              >
                <Text className={isSelected ? 'font-semibold text-white' : 'text-slate-800'}>
                  {format(month, 'MMM')}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}
