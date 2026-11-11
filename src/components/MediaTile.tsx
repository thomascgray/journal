import { Image } from 'expo-image';
import { getThumbnailAsync } from 'expo-video-thumbnails';
import { memo, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { DayMediaItem } from '@/hooks/useDayMedia';

// Generated video frames live in the cache directory. Keeping their URIs here means scrolling
// back to a video, or reopening the day, does not decode it again during this app session.
const videoThumbnails = new Map<string, string>();

function useTileImage(item: DayMediaItem): string | null {
  const [uri, setUri] = useState(() => videoThumbnails.get(item.id) ?? null);

  useEffect(() => {
    if (item.mediaType !== 'video' || item.previewUri || uri) return;
    let cancelled = false;
    getThumbnailAsync(item.id, { time: 0, quality: 0.5 })
      .then((result) => {
        videoThumbnails.set(item.id, result.uri);
        if (!cancelled) setUri(result.uri);
      })
      .catch((error) => console.warn('Video thumbnail failed', item.id, error));
    return () => {
      cancelled = true;
    };
  }, [item, uri]);

  if (item.previewUri) return item.previewUri;
  return item.mediaType === 'video' ? uri : item.id;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

type Props = {
  item: DayMediaItem;
  size: number;
  attached: boolean;
  onPress: (item: DayMediaItem) => void;
};

export const MediaTile = memo(function MediaTile({ item, size, attached, onPress }: Props) {
  const source = useTileImage(item);

  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: attached }}
      accessibilityLabel={item.mediaType === 'video' ? 'Video' : 'Photo'}
      style={{ width: size, height: size }}
      className="overflow-hidden rounded-lg bg-slate-100"
    >
      {source && (
        <Image
          source={{ uri: source }}
          recyclingKey={item.id}
          contentFit="cover"
          style={{ width: size, height: size, opacity: attached ? 1 : 0.55 }}
        />
      )}

      {item.mediaType === 'video' && item.duration != null && (
        <View className="absolute bottom-1 left-1 rounded bg-black/60 px-1">
          <Text className="text-[10px] font-medium text-white">
            {formatDuration(item.duration)}
          </Text>
        </View>
      )}

      {attached && (
        <>
          <View className="absolute inset-0 rounded-lg border-4 border-sky-500" />
          <View className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-sky-500">
            <Text className="text-xs font-bold text-white">✓</Text>
          </View>
        </>
      )}
    </Pressable>
  );
});
