import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

import { StatusPill } from '@/components/ChoreRow';
import { Avatar, Button, Card, Emoji, Muted, Screen, Section } from '@/components/ui';
import { api, photoUrl } from '@/lib/api';
import { useHousehold, useSession } from '@/lib/session';
import { ask, colors, dayLabel, memberColor, tell } from '@/lib/theme';

type Kind = 'before' | 'after';

export default function TaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { hh, me, member } = useHousehold();
  const setHousehold = useSession((s) => s.setHousehold);
  const [busy, setBusy] = useState<string | null>(null);

  if (!hh || !me || !member) return null;
  const t = hh.tasks.find((x) => x.id === id);
  const chore = t && hh.chores.find((c) => c.id === t.chore);
  if (!t || !chore) {
    return (
      <Screen top={false}>
        <Card>
          <Muted>This chore got moved around when the week was rebalanced.</Muted>
        </Card>
        <Button label="Back" onPress={() => router.back()} />
      </Screen>
    );
  }
  const who = hh.members.find((m) => m.id === t.member);
  const check = t.check;
  const look = chore.check.look_for.join(', ');

  async function snap(kind: Kind, from: 'camera' | 'library') {
    if (from === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return tell('Camera needed', 'Allow camera access so you can photograph the chore.');
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6 };
    const res = from === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets?.[0]) return;

    setBusy(kind);
    try {
      if (kind === 'before') {
        setHousehold(await api.before(hh!.id, t!.id, me!, res.assets[0].uri));
      } else {
        const out = await api.after(hh!.id, t!.id, me!, res.assets[0].uri);
        setHousehold(out.household);
      }
    } catch (e) {
      tell("Couldn't send the photo", (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function act(what: 'skip' | 'approve') {
    setBusy(what);
    try {
      const next = what === 'skip' ? await api.skip(hh!.id, t!.id, me!) : await api.approve(hh!.id, t!.id, me!);
      setHousehold(next);
      if (what === 'skip') router.back();
    } catch (e) {
      tell('That didn\'t work', (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const photoButtons = (kind: Kind) => (
    <View style={s.buttons}>
      <Button label="📷 Take photo" onPress={() => snap(kind, 'camera')} loading={busy === kind} style={{ flex: 1 }} />
      <Button label="Gallery" kind="ghost" onPress={() => snap(kind, 'library')} disabled={busy === kind} style={{ width: 100 }} />
    </View>
  );

  return (
    <Screen top={false}>
      <View style={s.head}>
        <Emoji icon={chore.icon} size={64} />
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{chore.name}</Text>
          <Text style={s.meta}>
            {dayLabel(hh, t.day)} · {chore.minutes} min
          </Text>
        </View>
      </View>

      <Card style={s.whoCard}>
        {who ? <Avatar name={who.name} color={memberColor(hh, who.id)} size={32} /> : null}
        <Text style={s.whoText}>{who?.id === me ? "It's yours" : `${who?.name ?? 'Someone'}'s chore`}</Text>
        <StatusPill status={t.status} />
      </Card>

      <Card style={s.how}>
        <Text style={s.howTitle}>How the photo check works</Text>
        <Muted>
          {chore.check.mode === 'show'
            ? `Snap a before photo, do the chore, then snap the after. SAM 3.1 looks for ${look} in the after photo.`
            : `Snap a before photo${chore.check.spot ? ` of the ${chore.check.spot}` : ''}, do the chore, then snap the same spot again. SAM 3.1 finds the ${look} in both and checks they're gone.`}
        </Muted>
      </Card>

      {t.status !== 'done' && (
        <>
          <Section>1 · Before</Section>
          {t.before ? <Image source={{ uri: photoUrl(t.before) }} style={s.photo} /> : null}
          {photoButtons('before')}

          {t.before ? (
            <>
              <Section>2 · After</Section>
              {busy === 'after' ? (
                <Card style={s.checking}>
                  <ActivityIndicator color={colors.lagoon} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.howTitle}>SAM 3.1 is comparing your photos…</Text>
                    <Muted>The first check in a while can take up to a minute while the GPU wakes up.</Muted>
                  </View>
                </Card>
              ) : (
                photoButtons('after')
              )}
            </>
          ) : null}
        </>
      )}

      {check ? (
        <>
          <Section>Result</Section>
          <Card style={check.verdict === 'done' ? s.good : s.bad}>
            <Text style={[s.verdict, { color: check.verdict === 'done' ? colors.good : colors.coral }]}>
              {check.verdict === 'done' ? (check.manual ? 'Approved ✓' : 'Verified ✓') : 'Not quite yet'}
            </Text>
            <Text style={s.reason}>{check.reason}</Text>
          </Card>
          {(t.before || t.after) && (
            <View style={s.pair}>
              {(['before', 'after'] as Kind[]).map((k) => {
                // the marked ones have what sam found painted on, fall back to the plain photo
                const marked = k === 'before' ? check.before_marked ?? t.before : check.after_marked ?? t.after;
                const count = check[k]?.count;
                return marked ? (
                  <View key={k} style={{ flex: 1 }}>
                    <Image source={{ uri: photoUrl(marked) }} style={s.small} />
                    <Text style={s.caption}>
                      {k === 'before' ? 'Before' : 'After'}
                      {count !== undefined ? ` · ${count} found` : ''}
                    </Text>
                  </View>
                ) : null;
              })}
            </View>
          )}
        </>
      ) : null}

      {t.status !== 'done' && (
        <View style={{ marginTop: 24, gap: 10 }}>
          <Button
            kind="ghost"
            label="Can't do it today"
            loading={busy === 'skip'}
            onPress={() => ask("Hand it off?", 'Someone free today will get it, and you will pick up something else later in the week.', 'Hand it off', () => act('skip'))}
          />
          {member.admin && (
            <Button kind="ghost" label="Mark as done (admin)" loading={busy === 'approve'} onPress={() => act('approve')} />
          )}
        </View>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  meta: { fontSize: 15, color: colors.muted, marginTop: 2 },
  whoCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  whoText: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.ink },
  how: { backgroundColor: colors.lagoonSoft, borderColor: colors.lagoonSoft },
  howTitle: { fontSize: 15, fontWeight: '800', color: colors.ink, marginBottom: 4 },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 18, marginBottom: 10, backgroundColor: colors.line },
  buttons: { flexDirection: 'row', gap: 10 },
  checking: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  good: { backgroundColor: colors.goodSoft, borderColor: colors.goodSoft },
  bad: { backgroundColor: colors.coralSoft, borderColor: colors.coralSoft },
  verdict: { fontSize: 20, fontWeight: '900', marginBottom: 4 },
  reason: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  pair: { flexDirection: 'row', gap: 10 },
  small: { width: '100%', aspectRatio: 3 / 4, borderRadius: 14, backgroundColor: colors.line },
  caption: { fontSize: 13, fontWeight: '700', color: colors.muted, marginTop: 6, textAlign: 'center' },
});
