@AGENTS.md

## This project

Android-first journal. The home screen is a scrolling calendar of months. Tapping a day opens
that day's entry: optional title, subtitle and body, plus a grid of every photo and video the
phone took that day. Tapping a photo or video attaches it to the day. "journal" is a placeholder
name (`app.json` name, slug, scheme, and `android.package` `app.journal.dev`).

## Stack

- Expo SDK 58, React Native 0.88, TypeScript strict, Expo Router with screens in `src/app/`.
- NativeWind v4 (Tailwind v3) via `className`. No `StyleSheet` in new code. `expo-image` does
  not take `className`; style it with `style`.
- `expo-sqlite` for storage, `expo-media-library` (new class API: `Query`, `Asset`) for the
  phone's media, `expo-video-thumbnails` for video frames, `date-fns` for dates.
- Import from `src/` with the `@/` alias.

## Rules

- Days are `yyyy-MM-dd` local date strings (`DateKey` in `src/lib/dates.ts`), never timestamps.
- Weeks start on Monday (`weekdayIndex`).
- Schema changes go in a new block in `src/db/migrate.ts`; never edit an existing block.
- Attachments store the media library asset ID (a `content://` URI on Android), not a copy of
  the file. Deleting a photo from the phone breaks its attachment.
- On Android the media library's `CREATION_TIME` is MediaStore `DATE_TAKEN` in milliseconds,
  despite the type comment saying seconds.
- Full media library access does not work in Expo Go on Android. Run a development build
  (`npx expo run:android`).

Checks before calling a task done: `npm run typecheck`, `npx expo-doctor`, `npx prettier --check "src/**/*.{ts,tsx}"`.
