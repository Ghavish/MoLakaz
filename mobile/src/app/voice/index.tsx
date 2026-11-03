import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { router, useLocalSearchParams } from 'expo-router';
import { Keyboard, Mic, RotateCcw, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Platform, Pressable, Text, View } from 'react-native';

import { Button, Header, IconButton, Screen, Txt, Waveform } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { font, useTheme } from '@/lib/theme';

const MAX_SECONDS = 120;
const BARS = 34;

type Phase = 'starting' | 'denied' | 'recording' | 'writing' | 'error';

function mmss(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// metering comes in as dBFS (about -160 silent to 0 loud). map the useful part to 0..1
function level(db?: number) {
  if (db === undefined || !isFinite(db)) return 0;
  return Math.min(1, Math.max(0, (db + 55) / 50));
}

export default function Voice() {
  const { c } = useTheme();
  const { mode = 'assistant' } = useLocalSearchParams<{ mode?: 'assistant' | 'dictation' }>();
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, 80);
  const [phase, setPhase] = useState<Phase>('starting');
  const [error, setError] = useState('');
  // the server answered but has no speech-to-text (local backend without whisper)
  const [noVoice, setNoVoice] = useState(false);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0));
  const [metered, setMetered] = useState(false);
  const stopping = useRef(false);
  const pulse = useRef(new Animated.Value(0)).current;

  const [heard, setHeard] = useState(0);
  const live = Math.floor(state.durationMillis / 1000);
  // the recorder resets its clock when it stops, so hold on to the length
  const secs = phase === 'recording' ? live : heard;

  async function start() {
    setError('');
    setLevels(Array(BARS).fill(0));
    stopping.current = false;
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) return setPhase('denied');
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase('recording');
    } catch (e) {
      setError((e as Error).message || "Couldn't start the microphone.");
      setPhase('error');
    }
  }

  useEffect(() => {
    // wake whisper up while they talk, so writing it out is quick
    api.warmTranscriber().catch(() => {});
    start();
    return () => {
      if (recorder.isRecording) recorder.stop().catch(() => {});
      setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    };
  }, []);

  // the live waveform follows the mic level, newest bar on the right
  useEffect(() => {
    if (phase !== 'recording') return;
    if (state.metering !== undefined) setMetered(true);
    setLevels((ls) => [...ls.slice(1), level(state.metering)]);
  }, [state.durationMillis, state.metering, phase]);

  useEffect(() => {
    if (phase === 'recording' && live >= MAX_SECONDS) stop();
  }, [live, phase]);

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

  async function stop() {
    if (stopping.current) return;
    stopping.current = true;
    setHeard(live);
    setPhase('writing');
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      const uri = recorder.uri;
      if (!uri) throw new Error("The recording didn't save. Try again.");
      const res = await api.transcribe(uri);
      router.replace({
        pathname: '/voice/confirm',
        params: { mode, text: res.text, secs: String(Math.max(1, Math.round(res.seconds || live))), audio: uri },
      });
    } catch (e) {
      setNoVoice(e instanceof ApiError && e.status === 503);
      setError((e as Error).message);
      setPhase('error');
    }
  }

  function typeInstead() {
    if (mode === 'dictation') router.back();
    else router.replace({ pathname: '/assistant', params: { focus: '1' } });
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

  const status = { starting: 'Starting…', denied: 'Microphone off', recording: 'Listening', writing: 'Writing it out', error: 'Stopped' }[phase];

  return (
    <Screen scroll={false}>
      <Header right={<Txt v="caption">{mmss(secs)}</Txt>} onBack={() => router.back()} />
      <View style={{ position: 'absolute', top: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }} pointerEvents="none">
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: phase === 'recording' ? c.coral.strong : c.textFaint }} />
        <Txt v="caption" color={c.text} style={{ fontFamily: font.medium }}>
          {status}
        </Txt>
      </View>

      <Txt v="caption" style={{ marginTop: 18, marginBottom: 6 }}>
        {mode === 'dictation' ? 'Describe your home' : "You're saying"}
      </Txt>
      <View style={{ minHeight: 120 }}>
        {phase === 'writing' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <ActivityIndicator color={c.ai.strong} />
            <Text style={{ fontFamily: font.medium, fontSize: 22, lineHeight: 32, color: c.textFaint }}>Writing out what you said…</Text>
          </View>
        ) : phase === 'denied' ? (
          <Text style={{ fontFamily: font.medium, fontSize: 22, lineHeight: 32, color: c.text }}>MoLakaz needs the microphone to hear you. Turn it on in your phone's settings, or type instead.</Text>
        ) : phase === 'error' ? (
          <>
            <Text style={{ fontFamily: font.medium, fontSize: 22, lineHeight: 32, color: c.text }}>{noVoice ? "Voice isn't switched on for this server yet." : error || 'Something went wrong.'}</Text>
            {noVoice && (
              <Txt v="caption" style={{ marginTop: 10 }}>
                Voice runs on the Modal backend. On a laptop backend it needs Whisper installed (requirements-voice.txt and ffmpeg). You can type your message instead.
              </Txt>
            )}
          </>
        ) : (
          <Text style={{ fontFamily: font.medium, fontSize: 28, lineHeight: 38, color: c.textFaint }}>
            {mode === 'dictation' ? 'Who lives there, when they’re free, and what needs doing…' : 'Go ahead, I’m listening…'}
          </Text>
        )}
      </View>

      <View style={{ marginTop: 30, height: 56, justifyContent: 'center' }}>
        {phase === 'recording' && metered ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 56 }}>
            {levels.map((l, i) => {
              const mid = 1 - Math.abs(i - (BARS - 1) / 2) / ((BARS - 1) / 2);
              return <View key={i} style={{ width: 4, height: Math.max(4, l * 56), borderRadius: 2, backgroundColor: c.ai.strong, opacity: 0.35 + 0.65 * mid }} />;
            })}
          </View>
        ) : phase === 'recording' ? (
          // no level readings (some browsers), so show the gentle animated bars instead
          <Waveform bars={BARS} height={56} />
        ) : phase === 'writing' ? (
          <Waveform bars={BARS} height={24} animated={false} />
        ) : null}
      </View>

      <View style={{ flex: 1 }} />
      {phase === 'denied' || phase === 'error' ? (
        <View style={{ gap: 10, marginBottom: 8 }}>
          {phase === 'error' && !noVoice && <Button label="Try again" icon={RotateCcw} onPress={start} />}
          <Button label="Type instead" kind="outline" icon={Keyboard} onPress={typeInstead} />
        </View>
      ) : (
        <>
          <Txt v="caption" style={{ marginBottom: 22 }}>
            {phase === 'writing' ? 'This takes a few seconds, longer if nobody has spoken to MoLakaz in a while.' : "Tap the mic when you're done. You can check it before it sends."}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, marginBottom: 8 }}>
            <IconButton icon={X} label="Cancel" onPress={() => router.back()} size={56} bg={c.surface} />
            <View style={{ width: 140, height: 140, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ position: 'absolute', width: 112, height: 112, borderRadius: 56, backgroundColor: c.ai.tint }} />
              {phase === 'recording' && ring(0, 128)}
              {phase === 'recording' && ring(0.5, 128)}
              <Pressable
                onPress={stop}
                disabled={phase !== 'recording'}
                accessibilityRole="button"
                accessibilityLabel="Stop recording"
                style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', opacity: phase === 'recording' ? 1 : 0.6 }}
              >
                {phase === 'writing' ? <ActivityIndicator color={c.onPrimary} /> : <Mic size={28} color={c.onPrimary} strokeWidth={2} />}
              </Pressable>
            </View>
            <IconButton icon={Keyboard} label="Type instead" onPress={typeInstead} size={56} bg={c.surface} />
          </View>
        </>
      )}
    </Screen>
  );
}
