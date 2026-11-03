import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { type ComponentRef, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { Button, Header, PersonTile, Screen, Section, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { font, personTone, radius, useTheme } from '@/lib/theme';
import type { Household } from '@/lib/types';

export default function Join() {
  const { c, shadow } = useTheme();
  const start = useSession((s) => s.start);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [code, setCode] = useState('');
  const [found, setFound] = useState<Household | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState<string | null>(null);

  async function change(text: string) {
    const next = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setCode(next);
    setError('');
    setFound(null);
    setPick(null);
    // look it up as soon as all 6 are in
    if (next.length === 6) {
      setBusy(true);
      try {
        setFound(await api.join(next));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    }
  }

  function go() {
    if (!found || !pick) return;
    start(found, pick);
    router.replace(found.chores.length ? '/today' : '/review');
  }

  const chosen = found?.members.find((m) => m.id === pick);

  return (
    <Screen footer={found ? <Button label={chosen ? `Continue as ${chosen.name}` : 'Pick who you are'} onPress={go} disabled={!chosen} /> : undefined}>
      <Header />
      <Txt v="title">Join your household</Txt>
      <Txt v="caption" style={{ marginBottom: 18 }}>
        Ask whoever set it up for the 6-letter code.
      </Txt>

      <Txt v="caption" style={{ marginBottom: 6 }}>
        Household code
      </Txt>
      <Pressable onPress={() => input.current?.focus()} accessibilityLabel="Household code" style={{ flexDirection: 'row', gap: 8 }}>
        {[...Array(6)].map((_, i) => {
          const active = i === Math.min(code.length, 5) && !found;
          return (
            <View
              key={i}
              style={[
                { flex: 1, height: 56, borderRadius: 14, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: active ? c.borderStrong : 'transparent' },
                shadow,
              ]}
            >
              <Text style={{ fontFamily: font.semibold, fontSize: 20, color: c.text }}>{code[i] ?? ''}</Text>
            </View>
          );
        })}
        {/* one hidden input drives the six boxes */}
        <TextInput
          ref={input}
          value={code}
          onChangeText={change}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          maxLength={6}
          caretHidden
          style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%' }}
        />
      </Pressable>

      <View style={{ minHeight: 30, justifyContent: 'center', marginTop: 6 }}>
        {busy ? (
          <ActivityIndicator color={c.textMuted} style={{ alignSelf: 'flex-start' }} />
        ) : found ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Check size={14} color={c.success.strong} strokeWidth={2.5} />
            <Txt v="caption" color={c.success.ink}>
              Found: {found.name} · {found.members.length} {found.members.length === 1 ? 'person' : 'people'}
            </Txt>
          </View>
        ) : error ? (
          <Txt v="caption" color={c.coral.ink}>
            {error}
          </Txt>
        ) : null}
      </View>

      {found && (
        <>
          <Section>Who are you?</Section>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {found.members.map((m) => {
              const t = personTone(c, found, m.id);
              const on = pick === m.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => setPick(m.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[
                    { width: '48%', flexGrow: 1, height: 92, borderRadius: radius.cardSmall, backgroundColor: c.surface, padding: 14, justifyContent: 'space-between', borderWidth: 2, borderColor: on ? t.strong : 'transparent' },
                    shadow,
                  ]}
                >
                  <PersonTile name={m.name} tone={t} size={32} filled={on} />
                  <Txt v="bodyMedium" numberOfLines={1} style={{ fontSize: 14 }}>
                    {m.name}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
          <Txt v="caption" style={{ marginTop: 14 }}>
            Not on the list? Ask whoever runs the home to add you.
          </Txt>
        </>
      )}
    </Screen>
  );
}
