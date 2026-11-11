import type { SQLiteDatabase } from 'expo-sqlite';

import type { DateKey } from '@/lib/dates';

export type Tag = {
  id: number;
  name: string;
};

/** A tag with the number of days it's on, for pickers. */
export type TagUsage = Tag & { dayCount: number };

/** Trims and collapses runs of whitespace. An empty result means there's no tag to add. */
export function cleanTagName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export async function getDayTags(db: SQLiteDatabase, date: DateKey): Promise<Tag[]> {
  return db.getAllAsync<Tag>(
    `SELECT tags.id, tags.name FROM day_tags JOIN tags ON tags.id = day_tags.tag_id
     WHERE day_tags.date = ? ORDER BY day_tags.added_at`,
    date,
  );
}

/** Every tag in use, most used first. */
export async function getAllTags(db: SQLiteDatabase): Promise<TagUsage[]> {
  return db.getAllAsync<TagUsage>(
    `SELECT tags.id, tags.name, COUNT(day_tags.date) AS dayCount
     FROM tags JOIN day_tags ON day_tags.tag_id = tags.id
     GROUP BY tags.id ORDER BY dayCount DESC, tags.name COLLATE NOCASE`,
  );
}

/**
 * Puts a tag on a day, creating the tag if no tag has that name. Names match ignoring case, so
 * the existing tag's spelling wins.
 */
export async function addTag(db: SQLiteDatabase, date: DateKey, name: string): Promise<Tag> {
  const clean = cleanTagName(name);
  if (clean === '') throw new Error('Tag name is empty');
  await db.runAsync(
    'INSERT OR IGNORE INTO tags (name, created_at) VALUES (?, ?)',
    clean,
    Date.now(),
  );
  // The column is COLLATE NOCASE, so this finds the tag whatever case it was created in.
  const tag = await db.getFirstAsync<Tag>('SELECT id, name FROM tags WHERE name = ?', clean);
  if (!tag) throw new Error(`Tag "${clean}" missing after insert`);
  await db.runAsync(
    'INSERT OR IGNORE INTO day_tags (date, tag_id, added_at) VALUES (?, ?, ?)',
    date,
    tag.id,
    Date.now(),
  );
  return tag;
}

/** Takes a tag off a day, and deletes the tag once no day has it. */
export async function removeTag(db: SQLiteDatabase, date: DateKey, tagId: number) {
  await db.runAsync('DELETE FROM day_tags WHERE date = ? AND tag_id = ?', date, tagId);
  await db.runAsync(
    'DELETE FROM tags WHERE id = ? AND NOT EXISTS (SELECT 1 FROM day_tags WHERE tag_id = ?)',
    tagId,
    tagId,
  );
}
