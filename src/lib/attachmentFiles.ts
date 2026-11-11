import { Image } from 'expo-image';
import { Directory, File, Paths } from 'expo-file-system';
import { Asset } from 'expo-media-library';
import { getThumbnailAsync } from 'expo-video-thumbnails';

import type { AttachmentMediaType } from '@/db/journal';

// Copies live in the documents directory, which Android never clears on its own. The database
// stores file names relative to this folder, not full paths.
const folder = new Directory(Paths.document, 'attachments');

export type StoredFiles = {
  fileName: string;
  /** A JPEG frame for videos, null for photos. */
  thumbName: string | null;
  width: number;
  height: number;
};

export function attachmentUri(name: string): string {
  return new File(folder, name).uri;
}

/** Copies a media library asset into the app's own storage, plus a frame for videos. */
export async function copyAsset(
  assetId: string,
  mediaType: AttachmentMediaType,
): Promise<StoredFiles> {
  folder.create({ idempotent: true, intermediates: true });

  const original = await new Asset(assetId).getFilename().catch(() => '');
  const extension =
    /\.[A-Za-z0-9]+$/.exec(original)?.[0] ?? (mediaType === 'video' ? '.mp4' : '.jpg');
  const base = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const copy = new File(folder, base + extension);
  await new File(assetId).copy(copy);

  try {
    if (mediaType === 'video') {
      const frame = await getThumbnailAsync(copy.uri, { time: 0, quality: 0.7 });
      const thumb = new File(folder, `${base}-thumb.jpg`);
      await new File(frame.uri).move(thumb);
      return {
        fileName: copy.name,
        thumbName: thumb.name,
        width: frame.width,
        height: frame.height,
      };
    }

    // Decoding a small version is enough for the aspect ratio, and expo-image applies EXIF
    // rotation, which MediaStore's width and height columns do not.
    const image = await Image.loadAsync(copy.uri, { maxWidth: 400 });
    const size = { width: image.width, height: image.height };
    image.release();
    return { fileName: copy.name, thumbName: null, ...size };
  } catch (error) {
    copy.delete();
    throw error;
  }
}

export function deleteFiles(names: (string | null)[]) {
  for (const name of names) {
    if (!name) continue;
    const file = new File(folder, name);
    if (file.exists) file.delete();
  }
}
