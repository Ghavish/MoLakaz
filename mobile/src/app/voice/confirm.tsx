import { router, useLocalSearchParams } from 'expo-router';
import { Mic, Pencil, Play, Send, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Button, Header, IconButton, Screen, TintCard, Txt, Waveform } from '@/components/ui';
import { useFlow } from '@/lib/flow';
import { font, radius, useTheme } from '@/lib/theme';

export default function Confirm() {
  const { c, shadow } = useTheme();
  const params = useLocalSearchParams<{ mode?: string; text?: string; secs?: string }>();
  const dictation = params.mode === 'dictation';
  const [text, setText] = useState(params.text ?? '');
  const [played, setPlayed] = useState(0.3);
  const setOutbox = useFlow((s) => s.setOutbox);
  const setDictation = useFlow((s) => s.setDictation);
  const secs = Number(params.secs || 0);

  function send() {
    if (!text.trim()) return;
    if (dictation) {
      setDictation(text.trim());
      router.back();
    } else {
      setOutbox(text.trim());
      router.replace('/assistant');
    }
  }

  return (
    <Screen
      footer={
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label="Re-record" kind="outline" icon={Mic} onPress={() => router.replace({ pathname: '/voice', params: { mode: params.mode } })} style={{ flex: 1 }} />
          <Button label={dictation ? 'Use this text' : 'Send'} onPress={send} disabled={!text.trim()} style={{ flex: 1.3 }} icon={dictation ? undefined : Send} />
        </View>
      }
    >
      <Header close title="Check your message" onBack={() => router.back()} />
      <Txt v="title" style={{ fontSize: 22, marginTop: 8 }}>
        Here's what we heard
      </Txt>
      <Txt v="caption" style={{ marginBottom: 16 }}>
        Fix anything we got wrong, then {dictation ? 'use it' : 'send it'}.
      </Txt>

      <Txt v="caption" style={{ marginBottom: 6 }}>
        Your message
      </Txt>
      <View style={[{ backgroundColor: c.surface, borderRadius: radius.cardSmall, borderWidth: 1.5, borderColor: c.ai.strong, padding: 16, marginBottom: 12 }, shadow]}>
        <TextInput
          multiline
          value={text}
          onChangeText={setText}
          style={{ fontFamily: font.medium, fontSize: 18, lineHeight: 27, color: c.text, minHeight: 110, textAlignVertical: 'top', padding: 0 }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <Pencil size={12} color={c.textMuted} strokeWidth={2} />
          <Txt v="caption">Tap the text to edit it</Txt>
        </View>
      </View>

      {/* TODO: play back the recorded audio once recording is real */}
      <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.surface, borderRadius: radius.cardSmall, padding: 10, marginBottom: 12 }, shadow]}>
        <IconButton icon={Play} label="Play it back" onPress={() => setPlayed((p) => (p >= 1 ? 0 : Math.min(1, p + 0.35)))} size={40} iconSize={16} bg={c.ai.strong} color="#FFFFFF" />
        <View style={{ flex: 1, overflow: 'hidden' }}>
          <Waveform bars={30} height={24} animated={false} played={played} barWidth={3} gap={3} />
        </View>
        <Txt v="caption">{`0:${String(secs).padStart(2, '0')}`}</Txt>
      </View>

      <TintCard tone="success" style={{ flexDirection: 'row', gap: 10 }}>
        <Sparkles size={14} color={c.success.ink} strokeWidth={2} style={{ marginTop: 3 }} />
        <Txt v="caption" color={c.success.ink} style={{ flex: 1 }}>
          {dictation ? "This goes into your household description. Nothing's saved until you build it." : "Nothing changes until you send. You'll see what moved and can undo it."}
        </Txt>
      </TintCard>
    </Screen>
  );
}
