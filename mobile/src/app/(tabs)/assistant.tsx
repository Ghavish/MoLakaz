import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Mic, Send, Sparkles } from 'lucide-react-native';
import { type ComponentRef, useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { Button, Chip, HScroll, IconButton, Screen, Txt } from '@/components/ui';
import { type ChatMessage, useFlow } from '@/lib/flow';
import { assistantSend, assistantUndo, type ActionSummary } from '@/lib/mocks';
import { useHousehold } from '@/lib/session';
import { font, radius, tell, useTheme } from '@/lib/theme';

const SUGGESTIONS = [
  { label: "I'm busy today", tone: 'coral' },
  { label: "What's left today?", tone: 'blue' },
  { label: 'Swap a chore', tone: 'success' },
  { label: 'Add a note', tone: 'amber' },
] as const;

const id = () => Math.random().toString(36).slice(2, 10);

export default function Assistant() {
  const { c, dark } = useTheme();
  const { hh, me, member } = useHousehold();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const chat = useFlow((s) => s.chat);
  const setChat = useFlow((s) => s.setChat);
  const outbox = useFlow((s) => s.outbox);
  const setOutbox = useFlow((s) => s.setOutbox);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const input = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (focus) setTimeout(() => input.current?.focus(), 300);
  }, [focus]);

  const send = useCallback(
    async (raw: string) => {
      const msg = raw.trim();
      if (!msg || !hh || !me) return;
      setText('');
      setChat((cs) => [...cs, { id: id(), from: 'me', text: msg }]);
      setTyping(true);
      try {
        const reply = await assistantSend(hh, me, msg);
        setChat((cs) => [...cs, { id: id(), from: 'assistant', text: reply.text, action: reply.action }]);
      } catch (e) {
        tell("Couldn't reach the assistant", (e as Error).message);
      } finally {
        setTyping(false);
      }
    },
    [hh, me],
  );

  // a message confirmed on the voice screens
  useFocusEffect(
    useCallback(() => {
      if (outbox) {
        send(outbox);
        setOutbox(null);
      }
    }, [outbox, send]),
  );

  async function undo(m: ChatMessage) {
    await assistantUndo();
    setChat((cs) => cs.map((x) => (x.id === m.id ? { ...x, undone: true } : x)));
  }

  if (!hh || !member) return null;

  const mineBg = dark ? c.highlight : c.primary;
  const mineFg = dark ? c.onHighlight : c.onPrimary;

  return (
    <Screen tab scroll={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: radius.tile, backgroundColor: c.ai.tint, alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={20} color={c.ai.strong} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt v="section">Assistant</Txt>
          <Txt v="caption">Moves chores for you and keeps the week fair</Txt>
        </View>
      </View>

      <ScrollView
        ref={scroll}
        style={{ flex: 1, marginHorizontal: -24 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 8, gap: 10 }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      >
        <Bubble from="assistant" text={`Hi ${member.name}! Tell me if you're busy, want to swap a chore, or want to know who's doing what.`} bg={c.surface} fg={c.text} />
        {chat.map((m) => (
          <View key={m.id} style={{ gap: 8 }}>
            <Bubble from={m.from} text={m.text} bg={m.from === 'me' ? mineBg : c.surface} fg={m.from === 'me' ? mineFg : c.text} />
            {m.action ? <Summary action={m.action} undone={m.undone} onUndo={() => undo(m)} /> : null}
          </View>
        ))}
        {typing && <Bubble from="assistant" text="…" bg={c.surface} fg={c.textMuted} />}
      </ScrollView>

      <HScroll style={{ marginVertical: 10 }}>
        {SUGGESTIONS.map((s) => (
          <Chip key={s.label} label={s.label} tone={s.tone} onPress={() => send(s.label)} />
        ))}
      </HScroll>

      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 26, height: 52, paddingLeft: 18, paddingRight: 6, gap: 4 }}>
        <TextInput
          ref={input}
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => send(text)}
          placeholder="Ask or tell it something…"
          placeholderTextColor={c.textFaint}
          returnKeyType="send"
          style={{ flex: 1, minWidth: 0, fontFamily: font.regular, fontSize: 14, color: c.text, height: 52 }}
        />
        <IconButton icon={Mic} label="Speak instead" onPress={() => router.push('/voice')} size={40} iconSize={18} bg="transparent" color={c.textMuted} />
        <IconButton icon={Send} label="Send" onPress={() => send(text)} size={40} iconSize={17} bg={c.primary} color={c.onPrimary} />
      </View>
    </Screen>
  );
}

function Bubble({ from, text, bg, fg }: { from: 'me' | 'assistant'; text: string; bg: string; fg: string }) {
  const { shadow } = useTheme();
  const me = from === 'me';
  return (
    <View
      style={[
        {
          alignSelf: me ? 'flex-end' : 'flex-start',
          maxWidth: '82%',
          backgroundColor: bg,
          paddingHorizontal: 16,
          paddingVertical: 11,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderBottomLeftRadius: me ? 20 : 6,
          borderBottomRightRadius: me ? 6 : 20,
        },
        !me && shadow,
      ]}
    >
      <Text style={{ fontFamily: font.regular, fontSize: 13.5, lineHeight: 21, color: fg }}>{text}</Text>
    </View>
  );
}

function Summary({ action, undone, onUndo }: { action: ActionSummary; undone?: boolean; onUndo: () => void }) {
  const { c, shadow } = useTheme();
  const row = (label: string, value: string, color: string) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 3 }}>
      <Txt v="caption">{label}</Txt>
      <Text style={{ fontFamily: font.semibold, fontSize: 12, color, flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
  return (
    <View style={[{ backgroundColor: c.surfaceSubtle, borderRadius: radius.cardSmall, padding: 14, maxWidth: '88%', opacity: undone ? 0.6 : 1 }, shadow]}>
      {action.moved ? row('Moved', action.moved, c.coral.ink) : null}
      {action.added ? row('Added', action.added, c.success.ink) : null}
      {action.fairness ? row('Fairness', `${action.fairness.from}% → ${action.fairness.to}%`, c.blue.ink) : null}
      {undone ? (
        <Txt v="caption" center style={{ marginTop: 8 }}>
          Undone
        </Txt>
      ) : (
        <Button label="Undo" kind="outline" small onPress={onUndo} style={{ marginTop: 10, height: 40 }} />
      )}
    </View>
  );
}
