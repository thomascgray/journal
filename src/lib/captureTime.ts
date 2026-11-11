import { Asset } from 'expo-media-library';

// EXIF DateTimeOriginal is the camera's wall clock: "2026:10:12 08:15:30", no timezone.
const EXIF_DATE = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/;

/** Wall-clock capture time read as if it were UTC, in ms, or null without usable EXIF. */
export type WallClock = number | null;

// Reading EXIF opens the file, and stepping between days re-reads the same overlapping
// window, so results last for the session. A photo's capture time does not change.
const wallClockCache = new Map<string, WallClock>();

/** Photos only: videos carry no EXIF. Null when the photo has none or was deleted. */
export async function readWallClock(assetId: string): Promise<WallClock> {
  const cached = wallClockCache.get(assetId);
  if (cached !== undefined) return cached;
  let wallClock: WallClock = null;
  try {
    const exif = await new Asset(assetId).getExif();
    const match = EXIF_DATE.exec(exif.DateTimeOriginal ?? exif.DateTime ?? '');
    if (match) {
      const [y, mo, d, h, mi, s] = match.slice(1).map(Number);
      wallClock = Date.UTC(y, mo - 1, d, h, mi, s);
    }
  } catch (error) {
    console.warn('Reading EXIF failed', assetId, error);
  }
  wallClockCache.set(assetId, wallClock);
  return wallClock;
}

/** "yyyy-MM-dd" of a wall clock. */
export function wallClockDateKey(wallClock: number): string {
  return new Date(wallClock).toISOString().slice(0, 10);
}

/** "HH:mm" of a wall clock. */
export function wallClockTime(wallClock: number): string {
  return new Date(wallClock).toISOString().slice(11, 16);
}
