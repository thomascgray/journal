import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 5;

// Add a new `if (version === N)` block for each schema change. Never edit an old block:
// phones that already ran it will not run it again.
export async function migrate(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version >= DATABASE_VERSION) return;

  if (version === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = 'wal';
      CREATE TABLE entries (
        date TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        subtitle TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE attachments (
        date TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        media_type TEXT NOT NULL,
        attached_at INTEGER NOT NULL,
        PRIMARY KEY (date, asset_id)
      );
    `);
    version = 1;
  }

  if (version === 1) {
    // Attachments get a copy of the file inside the app, so they survive the original being
    // deleted from the phone. Rows from version 1 start with NULLs and are copied after launch.
    // width and height are the displayed size, after EXIF rotation.
    await db.execAsync(`
      ALTER TABLE attachments ADD COLUMN file_name TEXT;
      ALTER TABLE attachments ADD COLUMN thumb_name TEXT;
      ALTER TABLE attachments ADD COLUMN width INTEGER;
      ALTER TABLE attachments ADD COLUMN height INTEGER;
    `);
    version = 2;
  }

  if (version === 2) {
    // Entries are a single Markdown body. An old title becomes a level 1 heading and a subtitle
    // a level 2 heading at the top of the body, so nothing written is lost. One transaction, so
    // a failed DROP can't leave the headings added for the next launch to add again.
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        UPDATE entries SET body = rtrim(
          CASE WHEN trim(title) != '' THEN '# ' || trim(title) || char(10, 10) ELSE '' END ||
          CASE WHEN trim(subtitle) != '' THEN '## ' || trim(subtitle) || char(10, 10) ELSE '' END ||
          body,
          char(10)
        )
        WHERE trim(title) != '' OR trim(subtitle) != '';
        ALTER TABLE entries DROP COLUMN title;
        ALTER TABLE entries DROP COLUMN subtitle;
      `);
    });
    version = 3;
  }

  if (version === 3) {
    // Tag names are unique ignoring case, so "Japan" and "japan" are one tag. A tag is deleted
    // when it's removed from its last day; see `removeTag`.
    await db.execAsync(`
      CREATE TABLE tags (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE day_tags (
        date TEXT NOT NULL,
        tag_id INTEGER NOT NULL,
        added_at INTEGER NOT NULL,
        PRIMARY KEY (date, tag_id)
      );
      CREATE INDEX day_tags_tag ON day_tags (tag_id);
    `);
    version = 4;
  }

  if (version === 4) {
    await db.execAsync(`ALTER TABLE attachments ADD COLUMN caption TEXT NOT NULL DEFAULT ''`);
    version = 5;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
