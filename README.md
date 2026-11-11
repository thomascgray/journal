# Journal

An Android journal app. The home screen is a calendar. Tap a day to write a title, subtitle and
body for it, and to attach photos and videos you took that day. "Journal" is a placeholder name.

Built with Expo (React Native), TypeScript, NativeWind (Tailwind) and SQLite. Rules for working
in the code are in `CLAUDE.md` and `AGENTS.md`.

## Get the app on your phone

This builds a release APK on this computer and puts it on your phone. The APK has all the code
bundled in, so the app runs on its own, with no computer or Metro needed. Nothing goes through
Expo's servers.

It needs the Android Studio setup from "One-time setup" below. The scripts are Windows-only
(`.\gradlew`).

### 1. Build the APK

```
npm run apk:build
```

The first build takes about 8 minutes. Later ones take 2 or 3. The APK lands at:

```
android\app\build\outputs\apk\release\app-release.apk
```

It's about 36 MB and only has native code for `arm64-v8a`, which is what every current Android
phone runs. `buildArchs` under the `expo-build-properties` plugin in `app.json` sets that. As a
result, it won't install on the x86_64 emulator.

### 2. Put it on the phone

Pick one.

**Copy the file.** Needs no phone setup. Upload `app-release.apk` to Google Drive (or email it
to yourself, or drag it into the phone's Download folder over a USB cable in file transfer
mode). On the phone, open it from Drive or the Files app and tap Install. The first time,
Android asks you to allow installs from that app. Allow it, then go back and tap Install again.
Play Protect may warn about an unknown developer. Tap "Install anyway".

**USB cable, one command.** Turn on USB debugging once (see "Run it on your phone (USB)"),
plug the phone in, and run:

```
npm run apk
```

That builds, installs and opens the app in one go, so you can skip step 1.

**Wi-Fi, one command.** On Android 11 or later, wireless debugging replaces the cable. On the
phone, open Developer options, turn on Wireless debugging, tap it, then tap "Pair device with
pairing code". On the computer:

```
adb pair <ip>:<pairing port>     # enter the six-digit code
adb connect <ip>:<port>          # the port on the main Wireless debugging screen
```

Phone and computer need to be on the same Wi-Fi. After that, `npm run apk` installs over Wi-Fi.
The phone remembers the pairing, but you may need to run `adb connect` again after a restart.

### Updating

Build and install again the same way. The new APK installs over the old one and keeps your
entries. Bump `version` in `app.json` first so you can tell builds apart.

Local builds are signed with `android/app/debug.keystore`. That's the standard React Native
debug key, which `prebuild` writes every time, so it stays the same after `prebuild --clean`.
The development build uses the same key, so the release APK and the development build replace
each other without an uninstall. The key is fine for your own phone, but not for the Play
Store.

### After changing `app.json` or the icons

The build scripts compile whatever is in `android/`, and they don't read `app.json`. After
changing `app.json` (name, icons, plugins, permissions) or the images it points to, regenerate
the folder first:

```
npx expo prebuild --platform android --clean
```

If that fails with `EBUSY: resource busy or locked`, something has `android/` open. Close any
terminal sitting inside it and Android Studio, stop Gradle (`android\gradlew --stop`), then try
again.

`name` in `app.json` is the label under the icon. The icon is the three `android-icon-*.png`
images in `assets/` plus `android.adaptiveIcon.backgroundColor`.

Don't change `android.package` after you've installed the app. Android treats a new package as
a different app, so it installs alongside the old one and starts with an empty journal.

### Building in the cloud instead

`npm run apk:eas` builds the same APK on Expo's servers (see "Build in the cloud instead (EAS)"
below). EAS signs with its own key, not the local debug key. Switching between a cloud build
and a local build means uninstalling first, which deletes your entries.

## How running the app works

This app can't run in Expo Go, the generic app from the Play Store. On Android, Expo Go isn't
allowed full access to the photo library, and this app depends on that access. Instead you
install a **development build**: your own debug version of the app, with Expo's developer menu
built in.

Two pieces run while you develop:

- **The development build**, installed on a phone or emulator. You rebuild it only when native
  code changes: a new library with native code, or a permission or plugin change in `app.json`.
  Day to day you don't touch it.
- **Metro**, the dev server on your computer (`npm start`). It sends your TypeScript to the app.
  Saving a file reloads the app within a second or two.

So: build and install once, then `npm start` each time you sit down to work.

## One-time setup

1. Node 22 or later. Then `npm install` in this folder.
2. Android Studio, which brings the Android SDK, an emulator and a Java runtime. Set these
   environment variables so the build tools can find them:
   - `ANDROID_HOME` = `%LOCALAPPDATA%\Android\Sdk`
   - `JAVA_HOME` = `C:\Program Files\Android\Android Studio\jbr`
   - Add `%ANDROID_HOME%\platform-tools` to `PATH`, for `adb`.
3. Windows only: the native build has very long file paths. Turn on long paths in Windows, and
   make sure the Ninja that the Android SDK uses is 1.12 or later. The one bundled with CMake
   3.22.1 is 1.10.2 and fails with `Filename longer than 260 characters`. Check with:
   ```
   & "$env:LOCALAPPDATA\Android\Sdk\cmake\3.22.1\bin\ninja.exe" --version
   ```
   To fix it, download `ninja-win.zip` from https://github.com/ninja-build/ninja/releases and
   replace `ninja.exe` in that folder. Keep a copy of the old one.

## Run it on an emulator

1. Open Android Studio, go to Device Manager, and start a virtual device. This machine has one
   called `Medium_Phone_API_35`.
2. Build and install the app, then start Metro:
   ```
   npm run android
   ```
   The first build takes 10 to 20 minutes. Later builds take a minute or two.
3. Next time, if the app is already installed, just run `npm start` and press `a`.

The emulator has no photos of its own. To test attachments, open the emulator's Camera app and
take a few photos and a short video (it films a virtual room). They show up under today's
date. Files dragged onto the emulator window go to Downloads, often without a "date taken", so
they may not appear on any day.

## Run it on your phone (USB)

1. On the phone, turn on Developer options (Settings, About phone, tap "Build number" seven
   times). Then turn on USB debugging in Developer options.
2. Plug the phone in and accept the "Allow USB debugging" prompt.
3. Check the computer can see it: `adb devices` should list the phone as `device`.
4. Run `npm run android`. It builds, installs on the phone and starts Metro.

While the cable is connected, the app reaches Metro over USB. To work without the cable, see
the next section.

## Run it on your phone (Wi-Fi, after the first install)

Once the development build is on the phone, you don't need the cable:

1. Phone and computer on the same Wi-Fi network.
2. Run `npm start`. It prints a QR code.
3. Scan the QR code with the phone's camera, which opens it in the Journal app. Or open the
   Journal app and pick the server from the list on its launcher screen.

If the phone can't find the server (common on office or public networks), use
`npx expo start --tunnel`.

## Build in the cloud instead (EAS)

If local builds are a pain, Expo's build service (EAS) builds the APK on their servers. It
needs a free Expo account and nothing from Android Studio.

```
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform android
```

When it finishes it prints a link and a QR code. Open that on the phone to download and
install the APK. Android will ask you to allow installing from that source. Then run
`npm start` and connect as in the Wi-Fi section above.

The profiles are in `eas.json`:

| Profile       | What it is                                                                  |
| ------------- | --------------------------------------------------------------------------- |
| `development` | The development build. Needs Metro running to work.                         |
| `preview`     | A standalone APK with the code bundled in. Works without a computer.        |
| `production`  | A Play Store build. Set a real `android.package` in `app.json` before this. |

To use the app day to day without a computer running, install a `preview` build (see
"Get the app on your phone" above).

The development build and the preview APK share the same `android.package`, so the phone can
only have one installed at a time. Installing one replaces the other. If Android refuses
because the signatures differ, uninstall the old one first, which deletes its journal entries.

## When you need a new build

Rebuild (`npm run android`, or EAS) after:

- installing a package that has native code (most `expo-*` modules and anything that says
  "requires a development build"),
- changing `plugins`, permissions, `android.package` or icons in `app.json`.

Everything else, meaning any change under `src/`, only needs Metro. That applies to the
development build. The release APK has the code bundled in, so any change at all needs a new
APK (`npm run apk`).

Install packages with `npx expo install <package>`, not `npm install`. It picks the version
that matches the Expo SDK.

## Checks

```
npm run typecheck
npx expo-doctor
npx prettier --check "src/**/*.{ts,tsx}"
```

As of November 2026, `npx expo-doctor` (1.21.7) crashes with `Cannot find module '@expo/env'`.
The `expo-doctor` package lists `@expo/env` only as a dev dependency, so npm never installs it,
even though the published code requires it. The fault is in that package, not this project.
Until a fixed release comes out, the other two checks still work.

## Troubleshooting

- **App shows a red error about Metro or "unable to load script".** Metro isn't running or the
  phone can't reach it. Run `npm start`. Over USB, run `adb reverse tcp:8081 tcp:8081`.
- **Strange errors after changing config.** Clear Metro's cache with `npx expo start --clear`.
- **Native build fails after a dependency or `app.json` change.** Regenerate the Android
  project: `npx expo prebuild --platform android --clean`, then build again. The `android/`
  folder is generated and gitignored, so don't edit it by hand.
- **The day screen shows no photos.** Check the app has photo and video permission in Android
  Settings. Some files, such as screenshots and downloads, have no "date taken" and never show
  up on a day.
