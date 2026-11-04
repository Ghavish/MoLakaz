import { router, useLocalSearchParams } from 'expo-router';
import { Camera, CircleCheck, Hand, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { Image, View } from 'react-native';

import { choreMeta, StatusBadge } from '@/components/ChoreRow';
import { Button, Card, ChoreIcon, Header, PersonTile, Screen, Section, TintCard, Txt } from '@/components/ui';
import { api, photoUrl } from '@/lib/api';
import { useHousehold, useSession } from '@/lib/session';
import { ask, dayLabel, personTone, radius, tell, useTheme } from '@/lib/theme';

export default function ChoreDetail() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { hh, me, member } = useHousehold();
  const setHousehold = useSession((s) => s.setHousehold);
  const [busy, setBusy] = useState<string | null>(null);

  if (!hh || !me || !member) return null;
  const t = hh.tasks.find((x) => x.id === id);
  const chore = t && hh.chores.find((x) => x.id === t.chore);
  if (!t || !chore) {
    return (
      <Screen>
        <Header />
        <Card>
          <Txt v="body" muted>
            This chore got moved around when the week was rebalanced.
          </Txt>
        </Card>
      </Screen>
    );
  }

  const who = hh.members.find((m) => m.id === t.member);
  const mine = who?.id === me;
  const look = chore.check.look_for.join(', ');
  const done = t.status === 'done';

  async function act(what: 'skip' | 'approve') {
    setBusy(what);
    try {
      const next = what === 'skip' ? await api.skip(hh!.id, t!.id, me!) : await api.approve(hh!.id, t!.id, me!);
      setHousehold(next);
      if (what === 'skip') router.back();
    } catch (e) {
      tell("That didn't work", (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const photo = (step: 'before' | 'after') => router.push({ pathname: '/chore/[id]/photo', params: { id: t.id, step } });

  return (
    <Screen>
      <Header />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <ChoreIcon icon={chore.icon} size={56} />
        <View style={{ flex: 1 }}>
          <Txt v="title" style={{ fontSize: 22, lineHeight: 30 }}>
            {chore.name}
          </Txt>
          <Txt v="caption">
            {dayLabel(hh, t.day)} · {choreMeta(chore, t, true)}
          </Txt>
        </View>
      </View>

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        {who ? <PersonTile name={who.name} tone={personTone(c, hh, who.id)} size={36} /> : null}
        <Txt v="bodyMedium" style={{ flex: 1 }}>
          {mine ? "It's yours" : `${who?.name ?? 'Someone'}'s chore`}
        </Txt>
        <StatusBadge status={t.status} />
      </Card>

      <TintCard tone="ai" style={{ flexDirection: 'row', gap: 10 }}>
        <Sparkles size={14} color={c.ai.strong} strokeWidth={2} style={{ marginTop: 3 }} />
        <View style={{ flex: 1 }}>
          <Txt v="bodyMedium" color={c.ai.ink} style={{ fontSize: 13.5 }}>
            How the photo check works
          </Txt>
          <Txt v="caption" color={c.ai.ink}>
            {chore.check.mode === 'show'
              ? `Snap a before photo, do the chore, then snap the after. SAM 3.1 looks for ${look} in the after photo.`
              : `Snap a before photo${chore.check.spot ? ` of the ${chore.check.spot}` : ''}, do the chore, then snap the same spot again. SAM 3.1 finds the ${look} in both and checks they're gone.`}
          </Txt>
        </View>
      </TintCard>

      {(t.before || t.after) && (
        <>
          <Section>Photos</Section>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {(['before', 'after'] as const).map((k) => {
              const src = photoUrl(k === 'before' ? t.check?.before_marked ?? t.before : t.check?.after_marked ?? t.after);
              return src ? (
                <View key={k} style={{ flex: 1 }}>
                  <Image source={{ uri: src }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: radius.cardSmall, backgroundColor: c.surfaceRaised }} />
                  <Txt v="caption" center style={{ marginTop: 6 }}>
                    {k === 'before' ? 'Before' : 'After'}
                  </Txt>
                </View>
              ) : null;
            })}
          </View>
        </>
      )}

      {t.check && (
        <Button label="See the photo check" kind="outline" small onPress={() => router.push({ pathname: '/chore/[id]/result', params: { id: t.id } })} style={{ marginTop: 14 }} />
      )}

      {!done && (
        <View style={{ marginTop: 24, gap: 10 }}>
          {t.status === 'todo' ? (
            <Button label="Start: take the before photo" icon={Camera} onPress={() => photo('before')} />
          ) : (
            <Button label={t.status === 'retry' ? 'Retake the after photo' : 'Take the after photo'} icon={Camera} onPress={() => photo('after')} />
          )}
          <Button
              kind="outline"
              icon={Hand}
              label="Can't do it today"
              loading={busy === 'skip'}
              onPress={() => ask('Hand it off?', 'Someone free today will get it, and you will pick up something else later in the week.', 'Hand it off', () => act('skip'))}
            />
          {member.admin && <Button kind="outline" icon={CircleCheck} label="Mark as done (admin)" loading={busy === 'approve'} onPress={() => act('approve')} />}
        </View>
      )}
    </Screen>
  );
}
