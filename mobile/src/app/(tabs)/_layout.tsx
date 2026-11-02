import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { registerPush } from '@/lib/push';
import { useHydrated, useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

export default function TabsLayout() {
  const ready = useHydrated();
  const hid = useSession((s) => s.hid);
  const me = useSession((s) => s.me);

  useEffect(() => {
    if (hid && me) registerPush(hid, me);
  }, [hid, me]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  if (!hid) return <Redirect href="/welcome" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.lagoon,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line },
        tabBarLabelStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="today" options={{ title: 'Today', tabBarIcon: ({ color, size }) => <Ionicons name="sunny-outline" color={color as string} size={size} /> }} />
      <Tabs.Screen name="week" options={{ title: 'Week', tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={color as string} size={size} /> }} />
      <Tabs.Screen name="family" options={{ title: 'Family', tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color as string} size={size} /> }} />
    </Tabs>
  );
}
