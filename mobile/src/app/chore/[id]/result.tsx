import { router, useLocalSearchParams } from 'expo-router';
import { Camera, Check, RotateCcw, Sparkles } from 'lucide-react-native';
import { Image, Pressable, Text, View } from 'react-native';

import { Button, Card, Header, Screen, Txt } from '@/components/ui';
import { photoUrl } from '@/lib/api';
import { askAdminToCheck } from '@/lib/mocks';
import { useHousehold } from '@/lib/session';
import { font, radius, tell, useTheme } from '@/lib/theme';

export default function Result() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { hh, me } = useHousehold();
  if (!hh || !me) return null;
  const t = hh.tasks.find((x) => x.id === id);
  const chore = t && hh.chores.find((x) => x.id === t.chore);
  const check = t?.check;
  if (!t || !chore || !check) {
    return (
      <Screen>
        <Header />
        <Card>
          <Txt v="body" muted>
            No photo check for this chore yet.
          </Txt>
        </Card>
      </Screen>
    );
  }

  const ok = check.verdict === 'done';
  const who = hh.members.find((m) => m.id === t.member);
  const admin = hh.members.find((m) => m.admin);
  const spot = chore.check.spot || 'spot';
  const look = chore.check.look_for.join(', ');
  const show = chore.check.mode === 'show';
  const b = check.before?.count;
  const a = check.after?.count;

  const beforeCaption = show ? 'Before' : b !== undefined ? (b ? `Found ${b} × ${look}` : `Nothing found to clear`) : 'Before';
  const afterCaption = ok
    ? show
      ? `Found the ${look}`
      : chore.check.spot
        ? `Same ${spot} found, nothing left in it`
        : 'Nothing left to clear'
    : show
      ? `Couldn't see the ${look} yet`
      : a !== undefined
        ? `${a} still there`
        : 'Not clear yet';

  const card = (label: string, src: string | undefined, caption: string, color: string) => (
    <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
      <View style={{ aspectRatio: 16 / 9, backgroundColor: c.surfaceRaised }}>
        {src ? <Image source={{ uri: src }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
        <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: c.surface, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ fontFamily: font.semibold, fontSize: 10, color: c.text }}>{label}</Text>
        </View>
      </View>
      <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.border }}>
        <Text style={{ fontFamily: font.medium, fontSize: 12, color }}>{caption}</Text>
      </View>
    </Card>
  );

  return (
    <Screen
      footer={
        <>
          {ok ? (
            <Button label="Back to today" onPress={() => router.replace('/today')} />
          ) : (
            <Button label="Retake the after photo" icon={Camera} onPress={() => router.replace({ pathname: '/chore/[id]/photo', params: { id: t.id, step: 'after' } })} />
          )}
          {admin && admin.id !== me ? (
            <Pressable
              onPress={async () => {
                await askAdminToCheck();
                tell('Sent', `${admin.name} will take a look.`);
              }}
              style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}
            >
              <Txt v="caption">
                {ok ? 'Not right?' : 'Think it is done?'} <Text style={{ fontFamily: font.semibold, color: c.text }}>Ask {admin.name} to check</Text>
              </Txt>
            </Pressable>
          ) : !ok ? (
            <Button label="Back to today" kind="outline" onPress={() => router.replace('/today')} style={{ marginTop: 10 }} />
          ) : null}
        </>
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: ok ? c.success.strong : c.coral.strong, alignItems: 'center', justifyContent: 'center' }}>
          {ok ? <Check size={22} color="#FFFFFF" strokeWidth={2.5} /> : <RotateCcw size={20} color="#FFFFFF" strokeWidth={2.5} />}
        </View>
        <View style={{ flex: 1 }}>
          <Txt v="section" style={{ fontSize: 18 }}>
            {ok ? (check.manual ? `${chore.name}: approved` : `${chore.name}: done`) : 'Some mess is still there'}
          </Txt>
          <Txt v="caption">
            {check.reason}
            {ok && who ? ` Nice one, ${who.id === me ? 'you' : who.name}.` : ''}
          </Txt>
        </View>
      </View>

      {card('Before', photoUrl(check.before_marked ?? t.before), beforeCaption, c.mess)}
      {card('After', photoUrl(check.after_marked ?? t.after), afterCaption, ok ? c.success.ink : c.mess)}

      {!check.manual && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Sparkles size={12} color={c.ai.strong} strokeWidth={2} />
          <Txt v="caption" style={{ fontSize: 11 }}>
            Checked by SAM 3.1
          </Txt>
        </View>
      )}
      <View style={{ height: radius.card }} />
    </Screen>
  );
}
