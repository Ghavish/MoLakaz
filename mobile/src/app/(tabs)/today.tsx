import { Redirect, router } from 'expo-router';
import { Clock, Mic, Moon, Sparkles, Sun } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoreCard, HeroChore } from '@/components/ChoreRow';
import { Button, Card, IconButton, PersonTile, ProgressRing, Screen, Section, TextLink, TintCard, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useHousehold, useSession } from '@/lib/session';
import { ask, dateOf, font, LONG_DAYS, personTone, tell, useTheme } from '@/lib/theme';
import type { Task } from '@/lib/types';
import { useRefresher } from '@/lib/useRefresher';

export default function Today() {
  const { c, dark, toggle } = useTheme();
  const insets = useSafeAreaInsets();
  const { hh, me, member } = useHousehold();
  const setHousehold = useSession((s) => s.setHousehold);
  const leave = useSession((s) => s.leave);
  const { refreshing, reload } = useRefresher();
  const [busy, setBusy] = useState(false);
  const [undo, setUndo] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // got taken out of the household
  const gone = !!hh && !member;
  useEffect(() => {
    if (gone) leave();
  }, [gone]);
  useEffect(() => () => clearTimeout(timer.current), []);

  if (!hh) return null;
  if (!member) return <Redirect href="/welcome" />;
  if (hh.chores.length === 0) return <Redirect href="/review" />;

  const today = hh.tasks.filter((t) => t.member === me && t.day === hh.today);
  const done = today.filter((t) => t.status === 'done').length;
  const hero = today.find((t) => t.status === 'started' || t.status === 'retry');
  const rest = [...today.filter((t) => t !== hero)].sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done'));
  const away = (member.away ?? []).includes(hh.today);
  const note = hh.messages?.[member.id];
  const tone = personTone(c, hh, member.id);

  function flash(text: string) {
    setUndo(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setUndo(null), 7000);
  }

  async function toggleAway(show = true) {
    setBusy(true);
    try {
      const next = await api.away(hh!.id, me!, hh!.today);
      setHousehold(next);
      const nowAway = (next.members.find((m) => m.id === me)?.away ?? []).includes(next.today);
      if (show) flash(nowAway ? 'Your chores for today went to whoever is free.' : "You're back on for today.");
      else setUndo(null);
    } catch (e) {
      tell("Couldn't change that", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function busyToday() {
    if (away) return toggleAway();
    ask('Busy today?', "Your chores for today go to whoever's free. You'll pick some up later in the week so it stays fair.", 'Hand them off', () => toggleAway());
  }

  function handOff(t: Task) {
    const name = hh!.chores.find((x) => x.id === t.chore)?.name ?? 'this chore';
    ask("Can't do it today?", `${name} goes to someone free today, and you'll pick up something else later in the week.`, 'Hand it off', async () => {
      try {
        setHousehold(await api.skip(hh!.id, t.id, me!));
      } catch (e) {
        tell("That didn't work", (e as Error).message);
      }
    });
  }

  const choreOf = (t: Task) => hh.chores.find((x) => x.id === t.chore);
  const heroChore = hero && choreOf(hero);

  return (
    <View style={{ flex: 1 }}>
      <Screen tab onRefresh={reload} refreshing={refreshing}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <PersonTile name={member.name} tone={tone} size={46} round ring />
          <View style={{ flex: 1 }}>
            <Txt v="caption">Hello,</Txt>
            <Txt v="section" style={{ fontSize: 18, marginTop: -2 }} numberOfLines={1}>
              {member.name}
            </Txt>
          </View>
          <IconButton icon={dark ? Sun : Moon} label={dark ? 'Switch to light mode' : 'Switch to dark mode'} onPress={toggle} bg={c.surface} />
          {today.length > 0 && <ProgressRing done={done} total={today.length} />}
        </View>

        <Txt v="caption" style={{ marginTop: 14, marginBottom: 14 }}>
          {LONG_DAYS[hh.today]}, {dateOf(hh.week, hh.today)}. Here's your day.
        </Txt>

        {/* ask bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: 26, backgroundColor: c.highlight, paddingLeft: 18, paddingRight: 6, marginBottom: 14 }}>
          <Pressable onPress={() => router.push('/assistant')} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: 52 }} accessibilityRole="button" accessibilityLabel="Ask MoLakaz">
            <Sparkles size={16} color={c.onHighlight} strokeWidth={2} />
            <Text style={{ fontFamily: font.regular, fontSize: 13.5, color: c.onHighlight, opacity: 0.75 }}>Ask MoLakaz to move a chore…</Text>
          </Pressable>
          <IconButton icon={Mic} label="Speak to MoLakaz" onPress={() => router.push('/voice')} size={40} iconSize={18} bg={dark ? '#161412' : '#FFFFFF'} color={dark ? '#F2EDE6' : '#0E1E3A'} />
        </View>

        {note ? (
          <TintCard tone="ai" style={{ flexDirection: 'row', gap: 10, marginBottom: 4 }}>
            <Sparkles size={14} color={c.ai.strong} strokeWidth={2} style={{ marginTop: 3 }} />
            <Txt v="body" color={c.ai.ink} style={{ flex: 1, fontSize: 13.5, lineHeight: 21 }}>
              {note}
            </Txt>
          </TintCard>
        ) : null}

        <Section right={<TextLink label="See week" onPress={() => router.push('/week')} />}>Your chores today</Section>

        {hero && heroChore ? <HeroChore chore={heroChore} task={hero} onLongPress={() => handOff(hero)} /> : null}
        {rest.map((t) => {
          const ch = choreOf(t);
          return ch ? <ChoreCard key={t.id} chore={ch} task={t} onLongPress={t.status === 'done' ? undefined : () => handOff(t)} /> : null;
        })}
        {today.length === 0 && (
          <Card>
            <Txt v="body" muted>
              {away ? "You're marked as busy today, so your chores went to others. You'll pick some up later in the week." : 'Nothing for you today. Enjoy!'}
            </Txt>
          </Card>
        )}
        {today.some((t) => t.status !== 'done') && (
          <Txt v="caption" center style={{ marginTop: 2 }}>
            Press and hold a chore if you can't do it today
          </Txt>
        )}

        <Button label={away ? "I'm free today after all" : 'Busy today?'} kind="outline" icon={Clock} small onPress={busyToday} loading={busy} style={{ marginTop: 14 }} />
      </Screen>

      {undo ? (
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: 88 + insets.bottom, alignItems: 'center' }} pointerEvents="box-none">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.highlight, borderRadius: 18, paddingLeft: 16, paddingRight: 6, paddingVertical: 6, maxWidth: 528, width: '100%' }}>
            <Text style={{ flex: 1, fontFamily: font.regular, fontSize: 13, color: c.onHighlight }}>{undo}</Text>
            <Pressable onPress={() => toggleAway(false)} style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' }} accessibilityRole="button">
              <Text style={{ fontFamily: font.semibold, fontSize: 13, color: dark ? '#C2410C' : '#F5A66E' }}>Undo</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}
