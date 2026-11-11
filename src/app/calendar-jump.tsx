import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MonthPicker } from '@/components/MonthPicker';
import { jumpCalendarTo, useCalendarPosition } from '@/hooks/useCalendarPosition';
import { parseDateKey } from '@/lib/dates';

const SHEET_PADDING = 16;

/** Presented as a bottom sheet over the calendar; see `_layout.tsx`. */
export default function CalendarJumpSheet() {
  const insets = useSafeAreaInsets();
  const { first, visible } = useCalendarPosition();
  const [today] = useState(() => new Date());

  return (
    <View style={{ padding: SHEET_PADDING, paddingBottom: insets.bottom + SHEET_PADDING }}>
      <MonthPicker
        heading="Jump to"
        selected={visible}
        today={today}
        earliest={(first && parseDateKey(first)) || undefined}
        onSelect={(month) => {
          jumpCalendarTo(month);
          router.back();
        }}
      />
    </View>
  );
}
