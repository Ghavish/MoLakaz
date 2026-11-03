import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { TabBar } from '@/components/TabBar';
import { registerPush } from '@/lib/push';
import { useHydrated, useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';

export default function TabsLayout() {
  const ready = useHydrated();
  const { c } = useTheme();
  const hid = useSession((s) => s.hid);
  const me = useSession((s) => s.me);

  useEffect(() => {
    if (hid && me) registerPush(hid, me);
  }, [hid, me]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: c.background }} />;
  if (!hid) return <Redirect href="/welcome" />;

  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.background } }}>
      <Tabs.Screen name="today" />
      <Tabs.Screen name="week" />
      <Tabs.Screen name="assistant" />
      <Tabs.Screen name="home" />
    </Tabs>
  );
}
