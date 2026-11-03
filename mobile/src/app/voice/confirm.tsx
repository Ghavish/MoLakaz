import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { router, useLocalSearchParams } from 'expo-router';
import { Mic, Pause, Pencil, Play, Send, Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Button, Header, IconButton, Screen, TintCard, Txt, Waveform } from '@/components/ui';
import { useFlow } from '@/lib/flow';
import { font, radius, useTheme } from '@/lib/theme';

export default function Confirm() {
  const { c, shadow } = useTheme();
  const params = useLocalSearchParams<{ mode?: string; text?: string; secs?: string; audio?: string }>();
  const dictation = params.mode === 'dictation';
  const [text, setText] = useState(params.text ?? '');
  const setOutbox = useFlow((s) => s.setOutbox);
  const setDictation = useFlow((s) => s.setDictation);
  const secs = Number(params.secs || 0);
  const player = useAudioPlayer(params.audio ? { uri: params.audio } : null);
  const status = useAudioPlayerStatus(player);
  const length = status.duration || secs;
  const played = length ? Math.min(1, status.currentTime / length) : 0;

  // back to normal playback (loudspeaker, not the earpiece) now recording is over
  useEffect(() => {
    setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
  }, []);

  function playPause() {
    if (status.playing) return player.pause();
    if (status.didJustFinish || (length && status.currentTime >= length - 0.05)) player.seekTo(0);
    player.play();
  }

  const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

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

      {params.audio ? (
        <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.surface, borderRadius: radius.cardSmall, padding: 10, marginBottom: 12 }, shadow]}>
          <IconButton icon={status.playing ? Pause : Play} label={status.playing ? 'Pause' : 'Play it back'} onPress={playPause} size={40} iconSize={16} bg={c.ai.strong} color="#FFFFFF" />
          <View style={{ flex: 1, overflow: 'hidden' }}>
            <Waveform bars={30} height={24} animated={false} played={played} barWidth={3} gap={3} />
          </View>
          <Txt v="caption">{status.playing || status.currentTime > 0 ? `${clock(status.currentTime)} / ${clock(length)}` : clock(length)}</Txt>
        </View>
      ) : null}

      <TintCard tone="success" style={{ flexDirection: 'row', gap: 10 }}>
        <Sparkles size={14} color={c.success.ink} strokeWidth={2} style={{ marginTop: 3 }} />
        <Txt v="caption" color={c.success.ink} style={{ flex: 1 }}>
          {dictation ? "This goes into your household description. Nothing's saved until you build it." : "Nothing changes until you send. You'll see what moved and can undo it."}
        </Txt>
      </TintCard>
    </Screen>
  );
}
