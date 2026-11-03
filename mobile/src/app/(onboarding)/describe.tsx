import { router, useFocusEffect } from 'expo-router';
import { Mic, Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Badge, Button, Card, Chip, Header, HScroll, IconButton, Input, Screen, TextLink, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useFlow } from '@/lib/flow';
import { useSession } from '@/lib/session';
import { font, tell, useTheme } from '@/lib/theme';
import type { Household } from '@/lib/types';

const HINTS = [
  { label: 'Who lives here', tone: 'coral', prompt: 'Who lives here: ' },
  { label: "When they're free", tone: 'blue', prompt: "When they're free: " },
  { label: 'What needs doing', tone: 'success', prompt: 'What needs doing: ' },
] as const;

export default function Describe() {
  const { c } = useTheme();
  const start = useSession((s) => s.start);
  const session = useSession();
  const setDraft = useFlow((s) => s.setDraft);
  const dictation = useFlow((s) => s.dictation);
  const setDictation = useFlow((s) => s.setDictation);

  const [home, setHome] = useState('');
  const [name, setName] = useState('');
  const [story, setStory] = useState('');
  const [ai, setAi] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<'build' | 'skip' | null>(null);

  useEffect(() => {
    api.health().then((h) => setAi(h.ai)).catch(() => setAi(null));
  }, []);

  // dictated text comes back from the voice screens
  useFocusEffect(
    useCallback(() => {
      if (dictation) {
        setStory((s) => (s.trim() ? s.trim() + ' ' : '') + dictation);
        setDictation(null);
      }
    }, [dictation]),
  );

  // reuse the household if they already made one and came back here
  async function household(): Promise<{ hh: Household; me: string }> {
    const mine = session.hh?.members.find((m) => m.id === session.me);
    if (session.hh && session.me && mine?.admin && session.hh.chores.length === 0) return { hh: session.hh, me: session.me };
    const res = await api.create(home.trim() || 'Our home', name.trim());
    start(res.household, res.me);
    return { hh: res.household, me: res.me };
  }

  async function go(kind: 'build' | 'skip') {
    setBusy(kind);
    try {
      const { hh, me } = await household();
      setDraft(null);
      if (kind === 'build' && ai !== false && story.trim()) {
        try {
          const draft = await api.readHousehold(story);
          const mine = hh.members.find((m) => m.id === me)!;
          // keep me as me, so i stay admin
          let people = draft.members.map((m) => (m.name.toLowerCase() === mine.name.toLowerCase() ? { ...m, id: me, admin: true } : m));
          if (!people.some((m) => m.id === me)) people = [mine, ...people];
          setDraft({ members: people, chores: draft.chores, notes: draft.notes });
        } catch (e) {
          tell('Muse Spark got stuck', `${(e as Error).message}\n\nYou can add people and chores by hand.`);
        }
      }
      router.replace('/review');
    } catch (e) {
      tell("Couldn't create the household", (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const named = name.trim().length > 0;
  const aiOff = ai === false;

  return (
    <Screen
      footer={
        <Button
          label={aiOff ? 'Continue' : 'Build my household'}
          arrow
          onPress={() => go('build')}
          loading={busy === 'build'}
          disabled={!named || (!aiOff && story.trim().length < 10) || !!busy}
        />
      }
    >
      <Header right={<TextLink label="Skip for now" onPress={() => (named ? go('skip') : tell('Add your name first', 'We need your name to set up the household.'))} />} />
      <Badge label="Optional" tone="amber" />
      <Txt v="title" style={{ marginTop: 10 }}>
        Tell us about your home
      </Txt>
      <Txt v="caption" style={{ marginBottom: 18 }}>
        Describe it in your own words and we'll set up the people, free time and chores. Or skip and add them yourself.
      </Txt>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input label="Your home's name" placeholder="Lakaz Ramdin" value={home} onChangeText={setHome} autoCapitalize="words" />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Your name" placeholder="John" value={name} onChangeText={setName} autoCapitalize="words" />
        </View>
      </View>

      <Txt v="caption" style={{ marginBottom: 6 }}>
        Your household
      </Txt>
      <Card style={{ padding: 16, marginBottom: 14 }}>
        <TextInput
          multiline
          value={story}
          onChangeText={setStory}
          editable={!aiOff}
          placeholder="Mum works 8–5 on weekdays. Dad works from home and is free after 6. John is at uni and has exams on Thursday. Sara is 9 and can do small jobs. We need the dishes done every night, laundry twice a week and the floors swept."
          placeholderTextColor={c.textFaint}
          style={{ minHeight: 150, fontFamily: font.regular, fontSize: 15, lineHeight: 24, color: c.text, textAlignVertical: 'top', padding: 0 }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
            <Sparkles size={14} color={c.ai.strong} strokeWidth={2} />
            <Txt v="caption">{aiOff ? "Muse Spark isn't switched on for this server, so add things by hand next." : 'Muse Spark sets it up'}</Txt>
          </View>
          {!aiOff && <IconButton icon={Mic} label="Dictate instead" onPress={() => router.push({ pathname: '/voice', params: { mode: 'dictation' } })} bg={c.ai.tint} color={c.ai.ink} size={40} iconSize={18} />}
        </View>
      </Card>

      {!aiOff && (
        <HScroll>
          {HINTS.map((h) => (
            <Chip key={h.label} label={h.label} tone={h.tone} onPress={() => setStory((s) => (s.trim() ? s.trimEnd() + '\n' : '') + h.prompt)} />
          ))}
        </HScroll>
      )}

      <View style={{ marginTop: 26, marginLeft: 4, transform: [{ rotate: '-6deg' }], alignSelf: 'flex-start' }}>
        <Txt v="script" color={c.ai.strong} style={{ fontSize: 36, lineHeight: 40 }}>
          Fair shares,{'\n'}happy home
        </Txt>
      </View>
    </Screen>
  );
}
