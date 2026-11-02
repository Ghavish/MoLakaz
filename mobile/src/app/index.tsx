import { Redirect } from 'expo-router';
import { View } from 'react-native';

import { useHydrated, useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

export default function Index() {
  const ready = useHydrated();
  const hid = useSession((s) => s.hid);
  const hh = useSession((s) => s.hh);

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  if (!hid) return <Redirect href="/welcome" />;
  if (hh && hh.chores.length === 0) return <Redirect href="/setup" />;
  return <Redirect href="/today" />;
}
