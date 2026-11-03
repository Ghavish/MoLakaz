import { router } from 'expo-router';
import { CalendarSync, LogOut, Monitor, Moon, RefreshCw, Sun } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { api } from '@/lib/api';
import { useHousehold, useSession } from '@/lib/session';
import { ask, tell, type ThemePref, useTheme } from '@/lib/theme';
import { Button, Segmented, Sheet, Txt } from './ui';

export function SettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { pref, setPref } = useTheme();
  const { hh, me, member } = useHousehold();
  const setHousehold = useSession((s) => s.setHousehold);
  const leave = useSession((s) => s.leave);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(what: 'plan' | 'rebalance') {
    if (!hh || !me) return;
    setBusy(what);
    try {
      setHousehold(what === 'plan' ? await api.plan(hh.id, me) : await api.rebalance(hh.id, me));
      onClose();
    } catch (e) {
      tell("That didn't work", (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Settings">
      <Txt v="caption" style={{ marginBottom: 8 }}>
        Appearance
      </Txt>
      <Segmented<ThemePref>
        value={pref}
        onChange={setPref}
        options={[
          { value: 'system', label: 'System', icon: Monitor },
          { value: 'light', label: 'Light', icon: Sun },
          { value: 'dark', label: 'Dark', icon: Moon },
        ]}
      />
      <Txt v="caption" style={{ marginTop: 6 }}>
        System follows your phone. You can also flip it from the sun/moon button on Today.
      </Txt>

      <Txt v="caption" style={{ marginTop: 22, marginBottom: 8 }}>
        This week
      </Txt>
      <View style={{ gap: 10 }}>
        <Button label="Rebalance from today" kind="outline" icon={RefreshCw} onPress={() => run('rebalance')} loading={busy === 'rebalance'} />
        {member?.admin && (
          <Button
            label="Re-plan the whole week"
            kind="outline"
            icon={CalendarSync}
            loading={busy === 'plan'}
            onPress={() => ask('Re-plan the week?', 'Chores that are done or in progress stay put. Everything else gets shared out again.', 'Re-plan', () => run('plan'))}
          />
        )}
      </View>

      <Txt v="caption" style={{ marginTop: 22, marginBottom: 8 }}>
        This phone
      </Txt>
      <Button
        label="Switch person / leave"
        kind="outline"
        icon={LogOut}
        onPress={() =>
          ask('Leave this household on this phone?', 'You can join again with the code.', 'Leave', () => {
            onClose();
            leave();
            router.replace('/welcome');
          })
        }
      />
      <Txt v="caption" center style={{ marginTop: 18 }}>
        Notifications are set in your phone's settings for MoLakaz.
      </Txt>
    </Sheet>
  );
}
