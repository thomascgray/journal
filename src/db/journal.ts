import type { SQLiteDatabase } from 'expo-sqlite';

import type { Tag } from '@/db/tags';
import { attachmentUri, copyAsset, deleteFiles } from '@/lib/attachmentFiles';
import type { DateKey } from '@/lib/dates';
import type { RangeBounds, SortOrder } from '@/lib/journalRange';

export type Entry = {
  date: DateKey;
  body: string;
};

export type AttachmentMediaType = 'image' | 'video';

export type Attachment = {
  assetId: string;
  mediaType: AttachmentMediaType;
};

/** An attachment row. The file fields stay null until the copy into app storage finishes. */
export type StoredAttachment = Attachment & {
  fileName: string | null;
  thumbName: string | null;
  width: number | null;
  height: number | null;
  /** Empty when there is none. Nothing edits or shows captions yet. */
  caption: string;
};

/** What the calendar needs to draw one day. */
export type DaySummary = {
  hasText: boolean;
  coverUri: string | null;
};

/** One day in the journal view. */
export type JournalDay = Entry & { attachments: StoredAttachment[]; tags: Tag[] };

/** Which days the journal view loads: a span of dates, or every day with a tag. */
export type JournalQuery = { kind: 'dates'; bounds: RangeBounds } | { kind: 'tag'; tagId: number };

const ATTACHMENT_COLUMNS = `asset_id AS assetId, media_type AS mediaType, file_name AS fileName,
  thumb_name AS thumbName, width, height, caption`;

/**
 * The image to show for an attachment: the app's copy when there is one, otherwise the phone's
 * original. Null for a video whose frame hasn't been made yet.
 */
export function previewUri(attachment: StoredAttachment): string | null {
  if (attachment.mediaType === 'video') {
    return attachment.thumbName ? attachmentUri(attachment.thumbName) : null;
  }
  return fullUri(attachment);
}

export async function getEntry(db: SQLiteDatabase, date: DateKey): Promise<Entry | null> {
  return db.getFirstAsync<Entry>('SELECT date, body FROM entries WHERE date = ?', date);
}

/** Saves the entry, or deletes the row when the body is blank. */
export async function saveEntry(db: SQLiteDatabase, entry: Entry) {
  if (entry.body.trim() === '') {
    await db.runAsync('DELETE FROM entries WHERE date = ?', entry.date);
    return;
  }
  await db.runAsync(
    `INSERT INTO entries (date, body, updated_at) VALUES (?, ?, ?)
     ON CONFLICT (date) DO UPDATE SET
       body = excluded.body,
       updated_at = excluded.updated_at`,
    entry.date,
    entry.body,
    Date.now(),
  );
}

/** The full-size file: the app's copy when there is one, otherwise the phone's original. */
export function fullUri(attachment: StoredAttachment): string {
  return attachment.fileName ? attachmentUri(attachment.fileName) : attachment.assetId;
}

export async function getAttachments(
  db: SQLiteDatabase,
  date: DateKey,
): Promise<StoredAttachment[]> {
  return db.getAllAsync<StoredAttachment>(
    `SELECT ${ATTACHMENT_COLUMNS} FROM attachments WHERE date = ? ORDER BY attached_at`,
    date,
  );
}

/**
 * Records the attachment straight away, then copies the file in the background. If the copy
 * fails, the row keeps pointing at the phone's original and `copyMissingAttachments` retries it
 * on the next launch.
 */
export async function attach(db: SQLiteDatabase, date: DateKey, attachment: Attachment) {
  await db.runAsync(
    `INSERT OR IGNORE INTO attachments (date, asset_id, media_type, attached_at)
     VALUES (?, ?, ?, ?)`,
    date,
    attachment.assetId,
    attachment.mediaType,
    Date.now(),
  );
  await storeCopy(db, date, attachment);
}

export async function detach(db: SQLiteDatabase, date: DateKey, assetId: string) {
  const row = await db.getFirstAsync<{ fileName: string | null; thumbName: string | null }>(
    `SELECT file_name AS fileName, thumb_name AS thumbName FROM attachments
     WHERE date = ? AND asset_id = ?`,
    date,
    assetId,
  );
  await db.runAsync('DELETE FROM attachments WHERE date = ? AND asset_id = ?', date, assetId);
  if (row) deleteFiles([row.fileName, row.thumbName]);
}

// Copies in progress, so a tap during the launch backfill doesn't copy the same file twice.
const copying = new Set<string>();

async function storeCopy(db: SQLiteDatabase, date: DateKey, attachment: Attachment) {
  const key = `${date}|${attachment.assetId}`;
  if (copying.has(key)) return;
  copying.add(key);
  try {
    const files = await copyAsset(attachment.assetId, attachment.mediaType);
    const result = await db.runAsync(
      `UPDATE attachments SET file_name = ?, thumb_name = ?, width = ?, height = ?
       WHERE date = ? AND asset_id = ? AND file_name IS NULL`,
      files.fileName,
      files.thumbName,
      files.width,
      files.height,
      date,
      attachment.assetId,
    );
    // Detached while copying, so nothing refers to the new files.
    if (result.changes === 0) deleteFiles([files.fileName, files.thumbName]);
  } finally {
    copying.delete(key);
  }
}

/** Copies every attachment that is still only a link to the phone's media. Runs at launch. */
export async function copyMissingAttachments(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<Attachment & { date: DateKey }>(
    `SELECT date, asset_id AS assetId, media_type AS mediaType FROM attachments
     WHERE file_name IS NULL ORDER BY attached_at`,
  );
  // One at a time: videos can be large, and the app is in use while this runs.
  for (const row of rows) {
    await storeCopy(db, row.date, row).catch((error) =>
      console.warn('Copying attachment failed', row.assetId, error),
    );
  }
}

// Loads every day at once. A journal holds at most a few thousand rows, so this is cheaper
// than querying per visible month.
export async function getDaySummaries(db: SQLiteDatabase): Promise<Map<DateKey, DaySummary>> {
  const [entries, attachments] = await Promise.all([
    db.getAllAsync<{ date: DateKey }>('SELECT date FROM entries'),
    db.getAllAsync<StoredAttachment & { date: DateKey }>(
      `SELECT date, ${ATTACHMENT_COLUMNS} FROM attachments ORDER BY attached_at`,
    ),
  ]);

  const summaries = new Map<DateKey, DaySummary>();
  const get = (date: DateKey) => {
    let summary = summaries.get(date);
    if (!summary) {
      summary = { hasText: false, coverUri: null };
      summaries.set(date, summary);
    }
    return summary;
  };

  for (const { date } of entries) get(date).hasText = true;
  for (const attachment of attachments) {
    const summary = get(attachment.date);
    if (!summary.coverUri) summary.coverUri = previewUri(attachment);
  }
  return summaries;
}

/** A WHERE condition on a table's `date` column, with its parameters. */
function dateCondition(query: JournalQuery, column: string): [string, (string | number)[]] {
  if (query.kind === 'dates') {
    return [`${column} BETWEEN ? AND ?`, [query.bounds.start, query.bounds.end]];
  }
  return [`${column} IN (SELECT date FROM day_tags WHERE tag_id = ?)`, [query.tagId]];
}

/** Every day matching `query` that has writing, attachments or tags. */
export async function getJournalDays(
  db: SQLiteDatabase,
  query: JournalQuery,
  order: SortOrder,
): Promise<JournalDay[]> {
  const [entryWhere, entryParams] = dateCondition(query, 'date');
  const [tagWhere, tagParams] = dateCondition(query, 'day_tags.date');
  const [entries, attachments, tags] = await Promise.all([
    db.getAllAsync<Entry>(`SELECT date, body FROM entries WHERE ${entryWhere}`, entryParams),
    db.getAllAsync<StoredAttachment & { date: DateKey }>(
      `SELECT date, ${ATTACHMENT_COLUMNS} FROM attachments WHERE ${entryWhere}
       ORDER BY attached_at`,
      entryParams,
    ),
    db.getAllAsync<Tag & { date: DateKey }>(
      `SELECT day_tags.date, tags.id, tags.name FROM day_tags
       JOIN tags ON tags.id = day_tags.tag_id
       WHERE ${tagWhere} ORDER BY day_tags.added_at`,
      tagParams,
    ),
  ]);

  const days = new Map<DateKey, JournalDay>();
  const get = (date: DateKey) => {
    let day = days.get(date);
    if (!day) {
      day = { date, body: '', attachments: [], tags: [] };
      days.set(date, day);
    }
    return day;
  };
  for (const entry of entries) get(entry.date).body = entry.body;
  for (const { date, ...attachment } of attachments) get(date).attachments.push(attachment);
  for (const { date, ...tag } of tags) get(date).tags.push(tag);
  // DateKeys sort correctly as strings.
  const sign = order === 'newest' ? 1 : -1;
  return [...days.values()].sort((a, b) => (a.date < b.date ? sign : -sign));
}
