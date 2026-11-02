import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Screen } from '@/components/ui';
import { colors } from '@/lib/theme';

export default function Welcome() {
  return (
    <Screen>
      <View style={s.hero}>
        <Text style={s.logo}>🏠</Text>
        <Text style={s.title}>MoLakaz</Text>
        <Text style={s.tag}>Chores shared out fairly, around everyone's week.</Text>
      </View>

      <View style={s.points}>
        <Point emoji="🗓️" text="Set up your home once. The AI splits chores by how much free time each person has." />
        <Point emoji="📸" text="Done? Snap a before and after photo. SAM 3.1 checks the mess is really gone." />
        <Point emoji="🔁" text="Busy day? Hand a chore off and the week rebalances itself." />
      </View>

      <Button label="Set up my household" onPress={() => router.push('/create')} />
      <Button label="Join with a code" kind="ghost" onPress={() => router.push('/join')} style={{ marginTop: 10 }} />
      <Text style={s.foot}>"Mo lakaz" means "my home" in Kreol Morisien</Text>
    </Screen>
  );
}

function Point({ emoji, text }: { emoji: string; text: string }) {
  return (
    <View style={s.point}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <Text style={s.pointText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { alignItems: 'center', marginTop: 36, marginBottom: 28 },
  logo: { fontSize: 64 },
  title: { fontSize: 44, fontWeight: '900', color: colors.lagoon, letterSpacing: -1, marginTop: 6 },
  tag: { fontSize: 17, color: colors.muted, textAlign: 'center', marginTop: 8, lineHeight: 24, maxWidth: 300 },
  points: { backgroundColor: colors.card, borderRadius: 22, padding: 18, gap: 16, marginBottom: 24, borderWidth: 1, borderColor: colors.line },
  point: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  pointText: { flex: 1, fontSize: 15, color: colors.ink, lineHeight: 21 },
  foot: { textAlign: 'center', color: colors.muted, fontSize: 13, marginTop: 22 },
});
