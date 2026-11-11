import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { previewUri, type StoredAttachment } from '@/db/journal';

const GAP = 6;
// Very tall or wide items are cropped to these ratios (height / width) so one panorama or
// screenshot doesn't dominate a column.
const MIN_RATIO = 0.6;
const MAX_RATIO = 1.8;
// The gallery stops at this height (as a multiple of its width) so a day with dozens of photos
// doesn't push the next day off screen. The last tile shown counts the rest.
const MAX_HEIGHT_RATIO = 1.2;

type Props = {
  attachments: StoredAttachment[];
  width: number;
  /** Called with the tapped item's index in `attachments`. */
  onPress: (index: number) => void;
};

type Placed = { attachment: StoredAttachment; index: number; height: number };

/** Two columns of photos and video frames at their own aspect ratios, shortest column first. */
export const Masonry = memo(function Masonry({ attachments, width, onPress }: Props) {
  // A single item gets the full width instead of half a row of empty space.
  const columnCount = attachments.length === 1 ? 1 : 2;
  const columnWidth = (width - GAP * (columnCount - 1)) / columnCount;
  const maxHeight = Math.round(width * MAX_HEIGHT_RATIO);

  const columns: { items: Placed[]; height: number }[] = Array.from(
    { length: columnCount },
    () => ({ items: [], height: 0 }),
  );
  let lastPlaced: Placed | null = null;
  for (const [index, attachment] of attachments.entries()) {
    const ratio = attachment.width && attachment.height ? attachment.height / attachment.width : 1;
    const height = Math.min(
      maxHeight,
      Math.round(columnWidth * Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio))),
    );
    const shortest = columns.reduce((a, b) => (b.height < a.height ? b : a));
    if (lastPlaced && shortest.height + height > maxHeight) break;
    lastPlaced = { attachment, index, height };
    shortest.items.push(lastPlaced);
    shortest.height += height + GAP;
  }
  const hidden = lastPlaced ? attachments.length - lastPlaced.index - 1 : 0;

  return (
    <View className="flex-row" style={{ gap: GAP }}>
      {columns.map((column, i) => (
        <View key={i} style={{ width: columnWidth, gap: GAP }}>
          {column.items.map((placed) => (
            <Tile
              key={placed.attachment.assetId}
              attachment={placed.attachment}
              width={columnWidth}
              height={placed.height}
              more={placed === lastPlaced ? hidden : 0}
              onPress={() => onPress(placed.index)}
            />
          ))}
        </View>
      ))}
    </View>
  );
});

function Tile({
  attachment,
  width,
  height,
  more,
  onPress,
}: {
  attachment: StoredAttachment;
  width: number;
  height: number;
  more: number;
  onPress: () => void;
}) {
  const uri = previewUri(attachment);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel={attachment.mediaType === 'video' ? 'Video' : 'Photo'}
      style={{ width, height }}
      className="overflow-hidden rounded-lg bg-slate-100"
    >
      {uri && (
        <Image
          source={{ uri }}
          recyclingKey={attachment.assetId}
          contentFit="cover"
          style={{ width, height }}
        />
      )}
      {attachment.mediaType === 'video' && (
        <View className="absolute bottom-1.5 left-1.5 h-7 w-7 items-center justify-center rounded-full bg-black/60">
          <Text className="text-xs text-white">▶</Text>
        </View>
      )}
      {more > 0 && (
        <View className="absolute inset-0 items-center justify-center bg-black/50">
          <Text className="text-2xl font-semibold text-white">+{more}</Text>
        </View>
      )}
    </Pressable>
  );
}
