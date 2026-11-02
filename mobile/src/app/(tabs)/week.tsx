import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChoreRow } from '@/components/ChoreRow';
import { Muted, Pill, Screen, Title } from '@/components/ui';
import { useHousehold } from '@/lib/session';
import { colors, dateOf, LONG_DAYS } from '@/lib/theme';
import { useRefresher } from '@/lib/useRefresher';

export default function Week() {
  const { hh, me } = useHousehold();
  const { refreshing, reload } = useRefresher();
  const [justMe, setJustMe] = useState(false);

  if (!hh) return null;
  const tasks = justMe ? hh.tasks.filter((t) => t.member === me) : hh.tasks;
  const done = tasks.filter((t) => t.status === 'done').length;

  return (
    <Screen onRefresh={reload} refreshing={refreshing}>
      <Title sub={`${done} of ${tasks.length} chores done this week`}>This week</Title>

      <View style={s.toggle}>
        {['Everyone', 'Just me'].map((label, i) => {
          const on = justMe === (i === 1);
          return (
            <Pressable key={label} onPress={() => setJustMe(i === 1)} style={[s.tab, on && s.tabOn]}>
              <Text style={[s.tabText, on && s.tabTextOn]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {LONG_DAYS.map((name, d) => {
        const day = tasks.filter((t) => t.day === d);
        const past = d < hh.today;
        return (
          <View key={d} style={{ marginBottom: 8 }}>
            <View style={s.dayHead}>
              <Text style={[s.dayName, past && { color: colors.muted }]}>{name}</Text>
              <Text style={s.dayDate}>{dateOf(hh.week, d)}</Text>
              {d === hh.today && <Pill label="Today" color="#fff" bg={colors.coral} />}
            </View>
            {day.length ? (
              day.map((t) => <ChoreRow key={t.id} hh={hh} task={t} showWho faded={past && t.status !== 'done'} />)
            ) : (
              <Muted style={{ marginLeft: 4, marginBottom: 6 }}>Nothing planned</Muted>
            )}
          </View>
        );
      })}
    </Screen>
  );
}

const s = StyleSheet.create({
  toggle: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: colors.line, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  tabOn: { backgroundColor: colors.lagoon },
  tabText: { fontWeight: '700', color: colors.muted },
  tabTextOn: { color: '#fff' },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, marginTop: 6 },
  dayName: { fontSize: 18, fontWeight: '800', color: colors.ink },
  dayDate: { fontSize: 14, color: colors.muted, flex: 1 },
});
