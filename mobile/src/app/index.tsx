import { Redirect } from 'expo-router';
import { View } from 'react-native';

import { useHydrated, useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';

export default function Index() {
  const ready = useHydrated();
  const { c } = useTheme();
  const hid = useSession((s) => s.hid);
  const hh = useSession((s) => s.hh);

  if (!ready) return <View style={{ flex: 1, backgroundColor: c.background }} />;
  if (!hid) return <Redirect href="/welcome" />;
  if (hh && hh.chores.length === 0) return <Redirect href="/review" />;
  return <Redirect href="/today" />;
}
