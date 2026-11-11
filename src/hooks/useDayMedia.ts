import {
  AssetField,
  type AssetMetadata,
  MediaType,
  type PermissionResponse,
  presentPermissionsPicker,
  Query,
  requestPermissionsAsync,
} from 'expo-media-library';
import { useCallback, useEffect, useState } from 'react';

import type { AttachmentMediaType } from '@/db/journal';
import { readWallClock, wallClockDateKey } from '@/lib/captureTime';
import { dayBounds, type DateKey, toDateKey } from '@/lib/dates';

export type DayMediaItem = {
  /** On Android this is a content:// URI, so it can go straight into an Image source. */
  id: string;
  mediaType: AttachmentMediaType;
  /** Video length in ms, null for photos. */
  duration: number | null;
  /** The app's own copy (a photo, or a video's frame), set once the item is attached. */
  previewUri?: string | null;
};

type State =
  | { status: 'loading' }
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'ready'; items: DayMediaItem[]; limited: boolean };

/** Every photo and video on the phone taken on `date`, oldest first. */
export function useDayMedia(date: Date) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const time = date.getTime();

  const load = useCallback(async () => {
    // Asking for photo and video only keeps the audio permission out of the prompt.
    const permission: PermissionResponse = await requestPermissionsAsync(false, ['photo', 'video']);
    if (!permission.granted) {
      setState({ status: 'denied', canAskAgain: permission.canAskAgain });
      return;
    }

    // Android filters on MediaStore DATE_TAKEN, which is in ms. Files without a DATE_TAKEN
    // (some downloads and screenshots) never match a day.
    const { start, end } = dayBounds(new Date(time));
    const candidates = await new Query()
      .within(AssetField.MEDIA_TYPE, [MediaType.IMAGE, MediaType.VIDEO])
      .gte(AssetField.CREATION_TIME, start - TIMEZONE_MARGIN_MS)
      .lt(AssetField.CREATION_TIME, end + TIMEZONE_MARGIN_MS)
      .orderBy({ key: AssetField.CREATION_TIME, ascending: true })
      .exeForMetadata();
    const assets = await takenOnDay(candidates, toDateKey(new Date(time)));

    setState({
      status: 'ready',
      limited: permission.accessPrivileges === 'limited',
      items: assets.map((asset) => ({
        id: asset.id,
        mediaType: asset.mediaType === MediaType.VIDEO ? 'video' : 'image',
        duration: asset.duration,
      })),
    });
  }, [time]);

  useEffect(() => {
    load().catch((error) => {
      console.warn('Loading media failed', error);
      setState({ status: 'ready', items: [], limited: false });
    });
  }, [load]);

  /** Android 14+ "selected photos only" access: lets the user pick more, then reloads. */
  const chooseMore = useCallback(async () => {
    await presentPermissionsPicker(['photo', 'video']);
    await load();
  }, [load]);

  return { state, reload: load, chooseMore };
}

// DATE_TAKEN is a UTC instant, so a photo taken in Tokyo at 8am on the 12th is 11pm on the 11th
// in London. A photo belongs to the day on the camera's clock where it was taken. The query
// reaches this far either side of the phone's local day to catch photos from other timezones;
// UTC+14 is the furthest any timezone gets from UTC.
const TIMEZONE_MARGIN_MS = 14 * 60 * 60 * 1000;
// Videos carry no EXIF. One taken this close to a photo is assumed to share its timezone.
const NEIGHBOUR_WINDOW_MS = 12 * 60 * 60 * 1000;

/**
 * The candidates taken on `dayKey` by the local clock where they were taken. Photos use their
 * EXIF time. Videos, and photos without EXIF, borrow the UTC offset of the nearest photo that
 * has one, and fall back to the phone's current timezone.
 */
async function takenOnDay(candidates: AssetMetadata[], dayKey: DateKey) {
  const wallClocks = await Promise.all(
    candidates.map((asset) =>
      asset.mediaType === MediaType.IMAGE ? readWallClock(asset.id) : Promise.resolve(null),
    ),
  );
  const offsets = candidates.flatMap((asset, i) => {
    const wallClock = wallClocks[i];
    return wallClock !== null && asset.creationTime !== null
      ? [{ at: asset.creationTime, offset: wallClock - asset.creationTime }]
      : [];
  });

  return candidates.filter((asset, i) => {
    const wallClock = wallClocks[i];
    if (wallClock !== null) return wallClockDateKey(wallClock) === dayKey;
    if (asset.creationTime === null) return false;

    const at = asset.creationTime;
    let nearest: { at: number; offset: number } | null = null;
    for (const o of offsets) {
      if (!nearest || Math.abs(o.at - at) < Math.abs(nearest.at - at)) nearest = o;
    }
    if (nearest && Math.abs(nearest.at - at) <= NEIGHBOUR_WINDOW_MS) {
      return wallClockDateKey(at + nearest.offset) === dayKey;
    }
    return toDateKey(new Date(at)) === dayKey;
  });
}
