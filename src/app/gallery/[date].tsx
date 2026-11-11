import { format } from 'date-fns';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { FlatList, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fullUri, getAttachments, previewUri, type StoredAttachment } from '@/db/journal';
import { readWallClock, wallClockTime } from '@/lib/captureTime';
import { parseDateKey } from '@/lib/dates';

/** A day's attachments at full size, one per page. Opened from the journal view's gallery. */
export default function GalleryScreen() {
  const { date, index } = useLocalSearchParams<{ date: string; index?: string }>();
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<StoredAttachment[] | null>(null);
  const [current, setCurrent] = useState(() => Number(index) || 0);
  const item = items?.[current];
  const time = useCaptureTime(item);

  useEffect(() => {
    getAttachments(db, date).then(setItems);
  }, [db, date]);

  // A plain string title: a custom headerTitle component is rebuilt on every swipe.
  const day = parseDateKey(date);
  const title = [
    day ? format(day, 'd MMM yyyy') : date,
    time,
    items && items.length > 1 ? `${current + 1}/${items.length}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View className="flex-1 bg-black">
      <Stack.Screen options={{ title }} />
      <StatusBar style="light" />
      {items && (
        <FlatList
          data={items}
          keyExtractor={(a) => a.assetId}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={items.length > 0 ? Math.min(current, items.length - 1) : undefined}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
          // Android defaults this to true, which detaches off-screen pages from the window. Glide
          // then hands their bitmaps back to its pool, and a page swiped back into view shows
          // black or another photo's pixels.
          removeClippedSubviews={false}
          // Two pages either side, so a fast swipe lands on a page that has already decoded.
          windowSize={5}
          renderItem={({ item: a, index: i }) => (
            <View style={{ width, paddingBottom: insets.bottom }} className="flex-1">
              {a.mediaType === 'video' && Math.abs(i - current) <= 1 ? (
                <VideoPage uri={fullUri(a)} active={i === current} />
              ) : (
                // Videos further away show their thumbnail, so at most three players exist.
                <Image
                  source={{ uri: previewUri(a) ?? undefined }}
                  recyclingKey={a.assetId}
                  contentFit="contain"
                  style={{ flex: 1 }}
                />
              )}
            </View>
          )}
          extraData={current}
          ListEmptyComponent={
            <Text style={{ width }} className="mt-8 text-center text-slate-400">
              Nothing attached to this day.
            </Text>
          }
        />
      )}
    </View>
  );
}

/**
 * "08:15" by the camera's clock where the photo was taken. Null for videos, which carry no EXIF,
 * and for photos deleted from the phone, whose EXIF is gone with them.
 */
function useCaptureTime(item: StoredAttachment | undefined): string | null {
  const [time, setTime] = useState<{ assetId: string; value: string | null } | null>(null);
  const assetId = item?.mediaType === 'image' ? item.assetId : null;

  useEffect(() => {
    if (!assetId) return;
    let cancelled = false;
    readWallClock(assetId).then((wallClock) => {
      if (!cancelled)
        setTime({ assetId, value: wallClock === null ? null : wallClockTime(wallClock) });
    });
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  return time && time.assetId === assetId ? time.value : null;
}

/** Plays while it is the page on screen, and pauses when swiped away. */
function VideoPage({ uri, active }: { uri: string; active: boolean }) {
  const player = useVideoPlayer(uri);

  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [player, active]);

  // A SurfaceView draws in its own window layer and doesn't move with the pager, so it leaves
  // black or stale frames on neighbouring pages mid-swipe. A TextureView scrolls like any view.
  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="contain"
      surfaceType="textureView"
      style={{ flex: 1 }}
    />
  );
}
