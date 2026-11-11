import { type Href, router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const VIEWS: { label: string; description: string; href: Href }[] = [
  {
    label: 'Journal',
    description: 'Your writing and photos, by date range',
    href: '/journal',
  },
];

/** The header's top-left button. Opens a menu of the app's other views. */
export function AppMenuButton() {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const go = (href: Href) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Menu"
        hitSlop={12}
        className="mr-4 gap-1 py-2"
      >
        {[0, 1, 2].map((i) => (
          <View key={i} className="h-0.5 w-5 rounded-full bg-slate-800" />
        ))}
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <Pressable className="flex-1 bg-black/20" onPress={() => setOpen(false)}>
          <View
            style={{ marginTop: insets.top + 8 }}
            className="ml-2 w-64 overflow-hidden rounded-xl bg-white py-2 shadow-lg"
          >
            <View className="px-4 py-3">
              <Text className="text-base font-semibold text-slate-900">Calendar</Text>
              <Text className="text-xs text-slate-500">You are here</Text>
            </View>
            {VIEWS.map((view) => (
              <Pressable
                key={view.label}
                onPress={() => go(view.href)}
                className="px-4 py-3 active:bg-slate-100"
              >
                <Text className="text-base text-slate-900">{view.label}</Text>
                <Text className="text-xs text-slate-500">{view.description}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
