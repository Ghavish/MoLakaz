import { router } from 'expo-router';
import { useState } from 'react';

import { Button, Input, Screen, Title } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { tell } from '@/lib/theme';

export default function Create() {
  const start = useSession((s) => s.start);
  const [home, setHome] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      const res = await api.create(home.trim() || 'Our home', name.trim());
      start(res.household, res.me);
      router.replace('/setup');
    } catch (e) {
      tell("Couldn't create it", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title sub="You'll be the admin. Everyone else joins with a code.">New household</Title>
      <Input label="What do you call your home?" placeholder="Lakaz Ramdin" value={home} onChangeText={setHome} />
      <Input label="Your name" placeholder="Ali" value={name} onChangeText={setName} autoCapitalize="words" />
      <Button label="Create household" onPress={go} loading={busy} disabled={!name.trim()} />
      <Button label="Back" kind="ghost" onPress={() => router.back()} style={{ marginTop: 10 }} />
    </Screen>
  );
}
