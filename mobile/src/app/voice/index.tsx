import { router, useLocalSearchParams } from 'expo-router';
import { Keyboard, Mic, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, Text, View } from 'react-native';

import { Header, IconButton, Screen, Txt, Waveform } from '@/components/ui';
import { MOCK_TRANSCRIPTS } from '@/lib/mocks';
import { font, useTheme } from '@/lib/theme';

function mmss(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// TODO: speech-to-text. This plays back a sample transcript word by word so the flow can be tried end to end.
export default function Voice() {
  const { c } = useTheme();
  const { mode = 'assistant' } = useLocalSearchParams<{ mode?: 'assistant' | 'dictation' }>();
  const words = MOCK_TRANSCRIPTS[mode === 'dictation' ? 'dictation' : 'assistant'].split(' ');
  const [shown, setShown] = useState(0);
  const [secs, setSecs] = useState(0);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const w = setInterval(() => setShown((n) => Math.min(n + 1, words.length)), 260);
    const t = setInterval(() => setSecs((n) => n + 1), 1000);
    return () => {
      clearInterval(w);
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduced) => {
        if (reduced) return;
        loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: Platform.OS !== 'web' }));
        loop.start();
      });
    return () => loop?.stop();
  }, []);

  // the last few words aren't final yet, so they're faint
  const final = Math.max(0, shown - 4);
  const text = words.slice(0, shown).join(' ');

  function stop() {
    router.replace({ pathname: '/voice/confirm', params: { mode, text: text || words.join(' '), secs: String(Math.max(secs, 1)) } });
  }

  const ring = (delay: number, size: number) => {
    const p = Animated.modulo(Animated.add(pulse, delay), 1);
    return (
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.5,
          borderColor: c.ai.strong,
          opacity: p.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
          transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.25] }) }],
        }}
      />
    );
  };

  return (
    <Screen scroll={false}>
      <Header
        right={<Txt v="caption">{mmss(secs)}</Txt>}
        onBack={() => router.back()}
      />
      <View style={{ position: 'absolute', top: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }} pointerEvents="none">
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.coral.strong }} />
        <Txt v="caption" color={c.text} style={{ fontFamily: font.medium }}>
          Listening
        </Txt>
      </View>

      <Txt v="caption" style={{ marginTop: 18, marginBottom: 6 }}>
        You're saying
      </Txt>
      <Text style={{ fontFamily: font.medium, fontSize: mode === 'dictation' ? 22 : 28, lineHeight: mode === 'dictation' ? 32 : 38, minHeight: 120 }}>
        <Text style={{ color: c.text }}>{words.slice(0, final).join(' ')} </Text>
        <Text style={{ color: c.textFaint }}>{words.slice(final, shown).join(' ')}</Text>
      </Text>

      <View style={{ marginTop: 30 }}>
        <Waveform bars={34} height={56} />
      </View>

      <View style={{ flex: 1 }} />
      <Txt v="caption" style={{ marginBottom: 22 }}>
        Tap the mic when you're done. You can check it before it sends.
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, marginBottom: 8 }}>
        <IconButton icon={X} label="Cancel" onPress={() => router.back()} size={56} bg={c.surface} />
        <View style={{ width: 140, height: 140, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ position: 'absolute', width: 112, height: 112, borderRadius: 56, backgroundColor: c.ai.tint }} />
          {ring(0, 128)}
          {ring(0.5, 128)}
          <Pressable onPress={stop} accessibilityRole="button" accessibilityLabel="Stop recording" style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Mic size={28} color={c.onPrimary} strokeWidth={2} />
          </Pressable>
        </View>
        <IconButton
          icon={Keyboard}
          label="Type instead"
          onPress={() => (mode === 'dictation' ? router.back() : router.replace({ pathname: '/assistant', params: { focus: '1' } }))}
          size={56}
          bg={c.surface}
        />
      </View>
    </Screen>
  );
}
