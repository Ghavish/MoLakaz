import { router } from 'expo-router';
import { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import { Avatar, Button, Card, Muted, Pill, Screen, Section, Title } from '@/components/ui';
import { api } from '@/lib/api';
import { useHousehold, useSession } from '@/lib/session';
import { ask, colors, memberColor, tell } from '@/lib/theme';
import { useRefresher } from '@/lib/useRefresher';

export default function Family() {
  const { hh, me, member } = useHousehold();
  const setHousehold = useSession((s) => s.setHousehold);
  const leave = useSession((s) => s.leave);
  const { refreshing, reload } = useRefresher();
  const [busy, setBusy] = useState<string | null>(null);

  if (!hh || !member) return null;

  const fair = Math.round(hh.fairness * 100);
  const scale = Math.max(...hh.board.map((r) => Math.max(r.share, r.fair_share)), 0.01) * 1.15;

  async function run(what: 'plan' | 'rebalance') {
    setBusy(what);
    try {
      setHousehold(what === 'plan' ? await api.plan(hh!.id, me!) : await api.rebalance(hh!.id, me!));
    } catch (e) {
      tell('That didn\'t work', (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen onRefresh={reload} refreshing={refreshing}>
      <Title sub={hh.name}>Family</Title>

      <Card style={s.fairCard}>
        <Text style={s.fairLabel}>Fairness this week</Text>
        <Text style={s.fairNum}>{fair}%</Text>
        <Muted style={{ color: '#D9F0ED' }}>
          {fair >= 95
            ? "Everyone's chore time matches how much free time they have."
            : fair >= 85
              ? 'Pretty even. A rebalance might tighten it up.'
              : 'Some people are carrying more than their share. Try rebalancing.'}
        </Muted>
        <View style={s.by}>
          <Pill label={hh.plan_by === 'muse-spark' ? '✨ Planned by Muse Spark' : 'Fair-share plan'} color="#fff" bg="rgba(255,255,255,0.18)" />
        </View>
        {hh.summary ? <Text style={s.summary}>{hh.summary}</Text> : null}
      </Card>

      <Section>Who's doing what</Section>
      {hh.board.map((row) => {
        const m = hh.members.find((x) => x.id === row.member);
        if (!m) return null;
        const color = memberColor(hh, m.id);
        return (
          <Card key={m.id}>
            <View style={s.row}>
              <Avatar name={m.name} color={color} />
              <View style={{ flex: 1 }}>
                <Text style={s.name}>
                  {m.name}
                  {m.id === me ? ' (you)' : ''}
                </Text>
                <Muted>
                  {row.done}/{row.tasks} done · {row.minutes} min of chores · {row.free} min free
                </Muted>
              </View>
            </View>
            <View style={s.track}>
              <View style={[s.fill, { width: `${(row.share / scale) * 100}%`, backgroundColor: color }]} />
              <View style={[s.marker, { left: `${(row.fair_share / scale) * 100}%` }]} />
            </View>
            <Text style={s.legend}>
              Doing {Math.round(row.share * 100)}% of the chores · has {Math.round(row.fair_share * 100)}% of the free time
            </Text>
          </Card>
        );
      })}

      <Section>Invite the family</Section>
      <Card style={s.row}>
        <View style={{ flex: 1 }}>
          <Muted>Household code</Muted>
          <Text style={s.code}>{hh.code}</Text>
        </View>
        <Button
          small
          kind="soft"
          label="Share"
          onPress={() => Share.share({ message: `Join ${hh.name} on MoLakaz with the code ${hh.code}` }).catch(() => {})}
        />
      </Card>

      <Section>Plan</Section>
      <Button label="Rebalance from today" kind="soft" onPress={() => run('rebalance')} loading={busy === 'rebalance'} />
      {member.admin && (
        <>
          <Button
            label="Re-plan the whole week"
            kind="soft"
            onPress={() => ask('Re-plan the week?', 'Chores that are done or in progress stay put. Everything else gets shared out again.', 'Re-plan', () => run('plan'))}
            loading={busy === 'plan'}
            style={{ marginTop: 10 }}
          />
          <Button label="Edit people and chores" kind="ghost" onPress={() => router.push('/setup')} style={{ marginTop: 10 }} />
        </>
      )}
      <Button
        label="Switch person / leave"
        kind="ghost"
        onPress={() => ask('Leave this household on this phone?', 'You can join again with the code.', 'Leave', () => { leave(); router.replace('/welcome'); })}
        style={{ marginTop: 24 }}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  fairCard: { backgroundColor: colors.lagoon, borderColor: colors.lagoon, padding: 20 },
  fairLabel: { color: '#D9F0ED', fontWeight: '800', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  fairNum: { color: '#fff', fontSize: 56, fontWeight: '900', letterSpacing: -2, marginVertical: 2 },
  by: { flexDirection: 'row', marginTop: 12 },
  summary: { color: '#fff', marginTop: 10, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 17, fontWeight: '800', color: colors.ink },
  track: { height: 12, borderRadius: 6, backgroundColor: colors.bg, marginTop: 14, overflow: 'visible' },
  fill: { height: 12, borderRadius: 6 },
  marker: { position: 'absolute', top: -4, width: 3, height: 20, borderRadius: 2, backgroundColor: colors.ink, marginLeft: -1 },
  legend: { fontSize: 12, color: colors.muted, marginTop: 8 },
  code: { fontSize: 28, fontWeight: '900', letterSpacing: 4, color: colors.ink },
});
