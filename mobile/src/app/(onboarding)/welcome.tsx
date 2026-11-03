import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Txt } from '@/components/ui';
import { WelcomeArt } from '@/components/WelcomeArt';
import { font, space, useTheme } from '@/lib/theme';

export default function Welcome() {
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const ink = dark ? '#F5F2EE' : '#0E1E3A';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false} bounces={false}>
      <View style={{ height: 470, marginBottom: -70 }}>
        <WelcomeArt height={470} />
        <View style={{ position: 'absolute', top: insets.top + 48, left: 0, right: 0, alignItems: 'center' }}>
          <Text style={{ fontFamily: font.medium, fontSize: 26, letterSpacing: 26 * 0.45, color: ink, marginRight: -26 * 0.45 }}>MOLAKAZ</Text>
          <Text style={{ fontFamily: font.medium, fontSize: 10, letterSpacing: 10 * 0.32, color: dark ? c.textMuted : c.textSecondary, marginTop: 6 }}>SHARE · CHECK · REST</Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: space.screenX, width: '100%', maxWidth: 560, alignSelf: 'center', flex: 1, justifyContent: 'flex-end' }}>
        <Txt v="display">Chores, shared fairly{'\n'}around your home</Txt>
        <Txt v="script" color={c.script} style={{ marginTop: -4, marginBottom: 2 }}>
          mo lakaz, my home
        </Txt>
        <Txt v="body" muted style={{ fontSize: 14, marginBottom: 24 }}>
          Everyone gives up the same share of their free time. A quick photo confirms each chore is done.
        </Txt>
        <Button label="Create a household" kind="highlight" arrow onPress={() => router.push('/describe')} />
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8 }}>
          <Txt v="caption">Have a household code? </Txt>
          <Pressable onPress={() => router.push('/join')} hitSlop={14} accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ fontFamily: font.semibold, fontSize: 12.5, color: dark ? c.primary : c.text }}>Join</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
