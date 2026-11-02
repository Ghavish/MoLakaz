import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Avatar, Button, Card, Input, Muted, Screen, Section, Title } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { colors, memberColor, tell } from '@/lib/theme';
import type { Household } from '@/lib/types';

export default function Join() {
  const start = useSession((s) => s.start);
  const [code, setCode] = useState('');
  const [found, setFound] = useState<Household | null>(null);
  const [busy, setBusy] = useState(false);

  async function look() {
    setBusy(true);
    try {
      setFound(await api.join(code));
    } catch (e) {
      tell('Hmm', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function pick(id: string) {
    if (!found) return;
    start(found, id);
    router.replace(found.chores.length ? '/today' : '/setup');
  }

  return (
    <Screen>
      <Title sub="Ask whoever set up the household for the 6 letter code.">Join a household</Title>
      <Input
        label="Household code"
        placeholder="K7Q2PM"
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase())}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        style={{ fontSize: 24, letterSpacing: 6, fontWeight: '800' }}
      />
      {!found ? (
        <Button label="Find it" onPress={look} loading={busy} disabled={code.trim().length < 6} />
      ) : (
        <>
          <Section>Who are you in {found.name}?</Section>
          {found.members.map((m) => (
            <Pressable key={m.id} onPress={() => pick(m.id)}>
              <Card style={s.person}>
                <Avatar name={m.name} color={memberColor(found, m.id)} />
                <Text style={s.name}>{m.name}</Text>
                {m.admin ? <Muted>admin</Muted> : null}
              </Card>
            </Pressable>
          ))}
          <Muted>Not on the list? Ask the admin to add you in the household setup.</Muted>
        </>
      )}
      <Button label="Back" kind="ghost" onPress={() => router.back()} style={{ marginTop: 16 }} />
    </Screen>
  );
}

const s = StyleSheet.create({
  person: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.ink },
});
