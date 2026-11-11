import '../../global.css';

import { Stack } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AppMenuButton } from '@/components/AppMenu';
import { copyMissingAttachments } from '@/db/journal';
import { migrate } from '@/db/migrate';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="journal.db" onInit={migrate}>
      <CopyMissingAttachments />
      <Stack screenOptions={{ headerShadowVisible: false }}>
        <Stack.Screen
          name="index"
          options={{ title: 'Calendar', headerLeft: () => <AppMenuButton /> }}
        />
        <Stack.Screen
          name="calendar-jump"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: 'fitToContents',
            sheetCornerRadius: 16,
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="journal-filter"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: 'fitToContents',
            sheetCornerRadius: 16,
            // Android form sheets don't support native headers.
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="gallery/[date]"
          options={{
            animation: 'fade',
            headerStyle: { backgroundColor: 'black' },
            headerTintColor: 'white',
            contentStyle: { backgroundColor: 'black' },
          }}
        />
      </Stack>
      <StatusBar style="dark" />
    </SQLiteProvider>
  );
}

// Attachments made before files were copied, or whose copy failed, get copied after launch.
function CopyMissingAttachments() {
  const db = useSQLiteContext();
  useEffect(() => {
    copyMissingAttachments(db).catch((error) => console.warn('Attachment backfill failed', error));
  }, [db]);
  return null;
}
