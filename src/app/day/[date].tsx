import { addDays, format, isFuture, isToday } from 'date-fns';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Linking, Pressable, Text, useWindowDimensions, View } from 'react-native';

import { MarkdownInput } from '@/components/MarkdownInput';
import { MediaTile } from '@/components/MediaTile';
import { TagEditor } from '@/components/Tags';
import {
  attach,
  type Attachment,
  previewUri,
  type StoredAttachment,
  detach,
  type Entry,
  getAttachments,
  getEntry,
  saveEntry,
} from '@/db/journal';
import { addTag, getAllTags, getDayTags, removeTag, type Tag, type TagUsage } from '@/db/tags';
import { type DayMediaItem, useDayMedia } from '@/hooks/useDayMedia';
import { type DateKey, parseDateKey, toDateKey } from '@/lib/dates';

const SIDE_PADDING = 16;
const GAP = 8;
const COLUMNS = 4;
// The writing card fills this share of the screen, so the photos start below the fold.
const TEXT_SHARE = 0.6;
// The card's p-4, top and bottom.
const CARD_PADDING = 32;
const SAVE_DELAY_MS = 600;
// slate-400. Android's default placeholder grey is too faint on the light card.
const PLACEHOLDER_COLOR = '#94a3b8';

export default function DayScreen() {
  const { date: dateKey } = useLocalSearchParams<{ date: string }>();
  const date = useMemo(() => parseDateKey(dateKey), [dateKey]);

  if (!date) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Stack.Screen options={{ title: 'Journal' }} />
        <Text className="text-slate-500">That isn't a valid date.</Text>
      </View>
    );
  }
  // Keyed so stepping to another day remounts the editor: the old day's text saves on unmount
  // and nothing from it shows on the new day while that day loads.
  return <DayEditor key={dateKey} dateKey={dateKey} date={date} />;
}

/** Previous and next day. Replaces the route param so stepping through days adds no history. */
function DayStepper({ date }: { date: Date }) {
  const canGoForward = !isToday(date) && !isFuture(date);
  const step = (days: number) => router.setParams({ date: toDateKey(addDays(date, days)) });

  return (
    <View className="flex-row items-center">
      <Pressable
        onPress={() => step(-1)}
        accessibilityRole="button"
        accessibilityLabel="Previous day"
        hitSlop={8}
        className="rounded-full px-3 py-1 active:bg-slate-100"
      >
        <Text className="text-2xl text-slate-700">‹</Text>
      </Pressable>
      <Pressable
        onPress={() => step(1)}
        disabled={!canGoForward}
        accessibilityRole="button"
        accessibilityLabel="Next day"
        accessibilityState={{ disabled: !canGoForward }}
        hitSlop={8}
        className="rounded-full px-3 py-1 active:bg-slate-100"
      >
        <Text className={`text-2xl ${canGoForward ? 'text-slate-700' : 'text-slate-300'}`}>›</Text>
      </Pressable>
    </View>
  );
}

function DayEditor({ dateKey, date }: { dateKey: DateKey; date: Date }) {
  const db = useSQLiteContext();
  const { width, height } = useWindowDimensions();
  const entry = useAutosavedEntry(dateKey);
  const { attachments, toggle } = useAttachments(dateKey);
  const media = useDayMedia(date);
  const dayTags = useDayTags(dateKey);

  // Attached items missing from the day's media were deleted from the phone or are hidden by
  // "selected photos only" access. They show the app's copy and stay listed so they can still
  // be detached.
  const items = useMemo(() => {
    const onPhone = media.state.status === 'ready' ? media.state.items : [];
    const seen = new Set(onPhone.map((item) => item.id));
    const missing: DayMediaItem[] = [...attachments.values()]
      .filter((a) => !seen.has(a.assetId))
      .map((a) => ({
        id: a.assetId,
        mediaType: a.mediaType,
        duration: null,
        previewUri: previewUri(a),
      }));
    return [...onPhone, ...missing];
  }, [media.state, attachments]);

  const tileSize = Math.floor((width - SIDE_PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS);

  const header = (
    <View className="pb-4 pt-2">
      <Stack.Screen
        options={{
          title: format(date, 'MMMM do'),
          headerRight: () => <DayStepper date={date} />,
        }}
      />
      <TagEditor
        tags={dayTags.tags}
        allTags={dayTags.allTags}
        onAdd={dayTags.add}
        onRemove={dayTags.remove}
      />
      {entry.value && (
        <View className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <MarkdownInput
            value={entry.value.body}
            onChangeText={(body) => entry.update({ body })}
            placeholder="Write about your day"
            placeholderTextColor={PLACEHOLDER_COLOR}
            minHeight={Math.round(height * TEXT_SHARE) - CARD_PADDING}
          />
        </View>
      )}
      <MediaStatus media={media} itemCount={items.length} />
    </View>
  );

  return (
    <FlatList
      className="flex-1 bg-white"
      data={items}
      keyExtractor={(item) => item.id}
      numColumns={COLUMNS}
      renderItem={({ item }) => (
        <MediaTile
          item={item}
          size={tileSize}
          attached={attachments.has(item.id)}
          onPress={toggle}
        />
      )}
      // Passed as an element, not a component, so the inputs keep focus across re-renders.
      ListHeaderComponent={header}
      columnWrapperStyle={{ gap: GAP }}
      contentContainerStyle={{ paddingHorizontal: SIDE_PADDING, paddingBottom: 32, gap: GAP }}
      keyboardShouldPersistTaps="handled"
      extraData={attachments}
    />
  );
}

function MediaStatus({
  media,
  itemCount,
}: {
  media: ReturnType<typeof useDayMedia>;
  itemCount: number;
}) {
  const { state } = media;
  let message: string | null = null;
  let action: { label: string; onPress: () => void } | null = null;

  if (state.status === 'loading') {
    message = 'Looking for photos from this day…';
  } else if (state.status === 'denied') {
    message = 'Journal needs access to your photos and videos to show the ones from this day.';
    action = state.canAskAgain
      ? { label: 'Allow access', onPress: media.reload }
      : { label: 'Open settings', onPress: () => Linking.openSettings() };
  } else {
    if (itemCount === 0) message = 'No photos or videos from this day.';
    else message = 'Tap a photo or video to attach it to this day.';
    if (state.limited) {
      message += ' Journal can only see the photos you selected.';
      action = { label: 'Choose photos', onPress: media.chooseMore };
    }
  }

  return (
    <View className="mt-5">
      <Text className="text-sm text-slate-500">{message}</Text>
      {action && (
        <Pressable
          onPress={action.onPress}
          className="mt-2 self-start rounded-lg bg-slate-900 px-4 py-2"
        >
          <Text className="font-medium text-white">{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Loads the day's entry and saves edits shortly after typing stops, and on leaving the screen. */
function useAutosavedEntry(dateKey: DateKey) {
  const db = useSQLiteContext();
  const [value, setValue] = useState<Entry | null>(null);
  const latest = useRef<Entry | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current || !latest.current) return;
    dirty.current = false;
    saveEntry(db, latest.current).catch((error) => console.warn('Saving entry failed', error));
  }, [db]);

  useEffect(() => {
    let cancelled = false;
    getEntry(db, dateKey).then((row) => {
      if (cancelled) return;
      const entry = row ?? { date: dateKey, body: '' };
      latest.current = entry;
      setValue(entry);
    });
    return () => {
      cancelled = true;
      flush();
    };
  }, [db, dateKey, flush]);

  const update = useCallback(
    (fields: Partial<Omit<Entry, 'date'>>) => {
      if (!latest.current) return;
      const next = { ...latest.current, ...fields };
      latest.current = next;
      dirty.current = true;
      setValue(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DELAY_MS);
    },
    [flush],
  );

  return { value, update };
}

/** The day's tags plus every tag in use, for suggestions. Writes before updating the screen. */
function useDayTags(dateKey: DateKey) {
  const db = useSQLiteContext();
  const [tags, setTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<TagUsage[]>([]);

  const reload = useCallback(
    () =>
      Promise.all([getDayTags(db, dateKey), getAllTags(db)]).then(([day, all]) => {
        setTags(day);
        setAllTags(all);
      }),
    [db, dateKey],
  );

  useEffect(() => {
    reload().catch((error) => console.warn('Loading tags failed', error));
  }, [reload]);

  const add = useCallback(
    (name: string) => {
      addTag(db, dateKey, name)
        .then(reload)
        .catch((error) => console.warn('Adding tag failed', error));
    },
    [db, dateKey, reload],
  );

  const remove = useCallback(
    (tag: Tag) => {
      setTags((current) => current.filter((t) => t.id !== tag.id));
      removeTag(db, dateKey, tag.id)
        .then(reload)
        .catch((error) => console.warn('Removing tag failed', error));
    },
    [db, dateKey, reload],
  );

  return { tags, allTags, add, remove };
}

function useAttachments(dateKey: DateKey) {
  const db = useSQLiteContext();
  const [attachments, setAttachments] = useState<Map<string, StoredAttachment>>(new Map());

  useEffect(() => {
    getAttachments(db, dateKey).then((rows) =>
      setAttachments(new Map(rows.map((row) => [row.assetId, row]))),
    );
  }, [db, dateKey]);

  const current = useRef(attachments);
  current.current = attachments;

  // Updates the screen first and writes after, so taps feel instant.
  const toggle = useCallback(
    (item: DayMediaItem) => {
      const next = new Map(current.current);
      if (next.has(item.id)) {
        next.delete(item.id);
        detach(db, dateKey, item.id).catch((error) => console.warn('Detach failed', error));
      } else {
        const attachment: Attachment = { assetId: item.id, mediaType: item.mediaType };
        const stored = {
          ...attachment,
          fileName: null,
          thumbName: null,
          width: null,
          height: null,
          caption: '',
        };
        next.set(item.id, stored);
        attach(db, dateKey, attachment).catch((error) => console.warn('Attach failed', error));
      }
      current.current = next;
      setAttachments(next);
    },
    [db, dateKey],
  );

  return { attachments, toggle };
}
