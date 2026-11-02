import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ChoreRow } from '@/components/ChoreRow';
import { Button, Card, Muted, Screen, Section } from '@/components/ui';
import { api } from '@/lib/api';
import { useHousehold, useSession } from '@/lib/session';
import { colors, dateOf, dayLabel, LONG_DAYS, tell } from '@/lib/theme';
import { useRefresher } from '@/lib/useRefresher';

export default function Today() {
  const { hh, me, member } = useHousehold();
  const setHousehold = useSession((s) => s.setHousehold);
  const leave = useSession((s) => s.leave);
  const { refreshing, reload } = useRefresher();
  const [busy, setBusy] = useState(false);

  // got taken out of the household
  const gone = !!hh && !member;
  useEffect(() => {
    if (gone) leave();
  }, [gone]);

  if (!hh) return null;
  if (!member) return <Redirect href="/welcome" />;
  if (hh.chores.length === 0) return <Redirect href="/setup" />;

  const mine = hh.tasks.filter((t) => t.member === me);
  const today = mine.filter((t) => t.day === hh.today);
  const later = mine.filter((t) => t.day > hh.today && t.status !== 'done').slice(0, 6);
  const done = today.filter((t) => t.status === 'done').length;
  const away = (member.away ?? []).includes(hh.today);
  const note = hh.messages?.[member.id];

  async function toggleAway() {
    setBusy(true);
    try {
      setHousehold(await api.away(hh!.id, me!, hh!.today));
    } catch (e) {
      tell("Couldn't change that", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen onRefresh={reload} refreshing={refreshing}>
      <Text style={s.date}>
        {LONG_DAYS[hh.today]} {dateOf(hh.week, hh.today)}
      </Text>
      <Text style={s.hello}>Bonzour, {member.name} 👋</Text>

      {today.length > 0 && (
        <Card style={s.progress}>
          <Text style={s.progressText}>
            {done === today.length ? 'All done for today! 🌴' : `${done} of ${today.length} done today`}
          </Text>
          <View style={s.track}>
            <View style={[s.fill, { width: `${(done / today.length) * 100}%` }]} />
          </View>
        </Card>
      )}

      {note ? (
        <Card style={s.note}>
          <Text style={s.noteFrom}>✨ From the planner</Text>
          <Text style={s.noteText}>{note}</Text>
        </Card>
      ) : null}

      <Section>Your chores today</Section>
      {today.length ? (
        today.map((t) => <ChoreRow key={t.id} hh={hh} task={t} />)
      ) : (
        <Card>
          <Muted>{away ? "You're marked as away today, so your chores went to others. You'll pick some up later in the week." : 'Nothing for you today. Enjoy! 🌴'}</Muted>
        </Card>
      )}

      <Button
        kind="ghost"
        small
        label={away ? "I'm free today after all" : "Busy today? Hand my chores off"}
        onPress={toggleAway}
        loading={busy}
        style={{ marginTop: 4, alignSelf: 'flex-start' }}
      />

      {later.length > 0 && (
        <>
          <Section>Coming up</Section>
          {later.map((t) => (
            <View key={t.id}>
              <Text style={s.when}>{dayLabel(hh, t.day)}</Text>
              <ChoreRow hh={hh} task={t} />
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  date: { fontSize: 14, fontWeight: '800', color: colors.coral, textTransform: 'uppercase', letterSpacing: 1 },
  hello: { fontSize: 30, fontWeight: '800', color: colors.ink, letterSpacing: -0.5, marginTop: 4, marginBottom: 16 },
  progress: { backgroundColor: colors.lagoon, borderColor: colors.lagoon },
  progressText: { color: '#fff', fontSize: 17, fontWeight: '800', marginBottom: 10 },
  track: { height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5, backgroundColor: colors.sun },
  note: { backgroundColor: colors.sunSoft, borderColor: colors.sunSoft },
  noteFrom: { fontSize: 12, fontWeight: '800', color: '#9A6A00', marginBottom: 4 },
  noteText: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  when: { fontSize: 12, fontWeight: '800', color: colors.muted, marginBottom: 6, marginLeft: 4 },
});
