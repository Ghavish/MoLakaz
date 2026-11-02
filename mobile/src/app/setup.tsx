import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar, Button, Card, Emoji, Input, Muted, Pill, Screen, Section, Stepper, Title } from '@/components/ui';
import { api } from '@/lib/api';
import { useHousehold, useSession } from '@/lib/session';
import { colors, DAYS, memberColor, tell } from '@/lib/theme';
import type { Chore, Member } from '@/lib/types';

const QUICK = [
  ['dishes', 'Wash the dishes'],
  ['table', 'Clear the table'],
  ['sweep', 'Sweep the floor'],
  ['trash', 'Take out the trash'],
  ['tidy', 'Tidy the living room'],
  ['laundry', 'Fold the laundry'],
  ['bathroom', 'Clean the bathroom'],
  ['cook', 'Cook dinner'],
  ['yard', 'Sweep the yard'],
];

// tap a day to cycle through these
const FREE_STEPS = [0, 15, 30, 45, 60, 90, 120, 180, 240];
const EFFORT = ['', 'Easy', 'Medium', 'Hard'];

function tempId() {
  return 'm_' + Math.random().toString(36).slice(2, 10);
}

export default function Setup() {
  const { hh, me } = useHousehold();
  const setHousehold = useSession((s) => s.setHousehold);
  const [members, setMembers] = useState<Member[]>([]);
  const [chores, setChores] = useState<Chore[]>([]);
  const [notes, setNotes] = useState('');
  const [story, setStory] = useState('');
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!hh) return;
    setMembers(hh.members);
    setChores(hh.chores);
    setNotes(hh.notes || '');
  }, [hh?.id]);

  if (!hh || !me) return null;

  const editMember = (id: string, patch: Partial<Member>) =>
    setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const editChore = (id: string, patch: Partial<Chore>) =>
    setChores((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  async function addChore(name: string) {
    if (!name.trim()) return;
    if (chores.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) return;
    setBusy('chore:' + name);
    try {
      const c = await api.suggestChore(name.trim());
      setChores((cs) => [...cs, c]);
      setCustom('');
    } catch (e) {
      tell("Couldn't add that", (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function fillWithAI() {
    setBusy('ai');
    try {
      const draft = await api.readHousehold(story);
      const mine = members.find((m) => m.id === me)!;
      // keep me as me, so i stay admin
      let people = draft.members.map((m) =>
        m.name.toLowerCase() === mine.name.toLowerCase() ? { ...m, id: me!, admin: true } : m,
      );
      if (!people.some((m) => m.id === me)) people = [mine, ...people];
      setMembers(people);
      if (draft.chores.length) setChores(draft.chores);
      if (draft.notes) setNotes((n) => (n ? n + '\n' : '') + draft.notes);
    } catch (e) {
      tell('Muse Spark got stuck', (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!chores.length) return tell('Add at least one chore first');
    setBusy('save');
    try {
      setHousehold(await api.setup(hh!.id, me!, members, chores, notes));
      router.replace('/today');
    } catch (e) {
      tell("Couldn't save", (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <Title sub="Do this once. MoLakaz uses it to share out the chores every week.">Set up {hh.name}</Title>

      <Card style={{ backgroundColor: colors.lagoonSoft, borderColor: colors.lagoonSoft }}>
        <Text style={s.cardTitle}>✨ Just describe your home</Text>
        {hh.ai ? (
          <>
            <Muted>Who lives there, their work or school hours, and the chores you need done. Muse Spark fills in the rest.</Muted>
            <TextInput
              multiline
              value={story}
              onChangeText={setStory}
              placeholder="Me (Ali, 20, uni Mon-Fri till 4), Mum works 8-5, Dad does night shifts, my sister Zara is 9. We need dishes every day, the yard on weekends..."
              placeholderTextColor="#7FA9A6"
              style={s.story}
            />
            <Button label="Fill it in for me" onPress={fillWithAI} loading={busy === 'ai'} disabled={story.trim().length < 10} />
          </>
        ) : (
          <Muted>Muse Spark isn't switched on for this server yet (no MODEL_API_KEY), so fill it in by hand below.</Muted>
        )}
      </Card>

      <Section right={<Button small kind="soft" label="+ Person" onPress={() => setMembers((ms) => [...ms, { id: tempId(), name: '', age: 30, admin: false, free: [45, 45, 45, 45, 45, 120, 120], dislikes: [] }])} />}>
        People
      </Section>
      {members.map((m) => (
        <Card key={m.id}>
          <View style={s.row}>
            <Avatar name={m.name || '?'} color={memberColor({ ...hh, members }, m.id)} />
            <TextInput value={m.name} onChangeText={(name) => editMember(m.id, { name })} placeholder="Name" style={s.nameInput} placeholderTextColor="#A7ADB2" />
            {m.id === me ? <Pill label="You · admin" /> : (
              <Pressable hitSlop={10} onPress={() => setMembers((ms) => ms.filter((x) => x.id !== m.id))}>
                <Text style={s.remove}>✕</Text>
              </Pressable>
            )}
          </View>
          <View style={[s.row, { marginTop: 12 }]}>
            <Text style={s.label}>Age</Text>
            <Stepper value={m.age} min={1} max={99} onChange={(age) => editMember(m.id, { age })} />
          </View>
          <Text style={[s.label, { marginTop: 12, marginBottom: 6 }]}>Free time for chores (tap to change)</Text>
          <View style={s.days}>
            {m.free.map((mins, d) => (
              <Pressable
                key={d}
                onPress={() => {
                  const next = FREE_STEPS[(FREE_STEPS.indexOf(mins) + 1) % FREE_STEPS.length] ?? 0;
                  editMember(m.id, { free: m.free.map((x, i) => (i === d ? next : x)) });
                }}
                style={[s.day, mins === 0 && { backgroundColor: '#F1F1F1' }]}
              >
                <Text style={s.dayName}>{DAYS[d][0]}</Text>
                <Text style={[s.dayMins, mins === 0 && { color: colors.muted }]}>{mins ? mins + 'm' : '–'}</Text>
              </Pressable>
            ))}
          </View>
          {chores.length > 0 && (
            <>
              <Text style={[s.label, { marginTop: 12, marginBottom: 6 }]}>Would rather not do</Text>
              <View style={s.chips}>
                {chores.map((c) => {
                  const on = m.dislikes.includes(c.id);
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => editMember(m.id, { dislikes: on ? m.dislikes.filter((x) => x !== c.id) : [...m.dislikes, c.id] })}
                      style={[s.chip, on && { backgroundColor: colors.coralSoft, borderColor: colors.coral }]}
                    >
                      <Text style={[s.chipText, on && { color: colors.coral }]}>{c.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </Card>
      ))}

      <Section>Chores</Section>
      <View style={[s.chips, { marginBottom: 12 }]}>
        {QUICK.filter(([icon]) => !chores.some((c) => c.icon === icon)).map(([icon, name]) => (
          <Pressable key={icon} onPress={() => addChore(name)} style={s.chip} disabled={!!busy}>
            <Text style={s.chipText}>{busy === 'chore:' + name ? '…' : '+ ' + name}</Text>
          </Pressable>
        ))}
      </View>
      <View style={[s.row, { marginBottom: 12 }]}>
        <TextInput value={custom} onChangeText={setCustom} placeholder="Something else, like 'Walk the dog'" placeholderTextColor="#A7ADB2" style={[s.nameInput, s.customInput]} onSubmitEditing={() => addChore(custom)} />
        <Button small label="Add" onPress={() => addChore(custom)} disabled={!custom.trim()} loading={busy === 'chore:' + custom.trim()} />
      </View>

      {chores.map((c) => (
        <Card key={c.id}>
          <View style={s.row}>
            <Emoji icon={c.icon} size={40} />
            <TextInput value={c.name} onChangeText={(name) => editChore(c.id, { name })} style={s.nameInput} />
            <Pressable hitSlop={10} onPress={() => setChores((cs) => cs.filter((x) => x.id !== c.id))}>
              <Text style={s.remove}>✕</Text>
            </Pressable>
          </View>
          <View style={s.grid}>
            <View style={s.cell}>
              <Text style={s.label}>Takes</Text>
              <Stepper value={c.minutes} step={5} min={5} max={240} suffix="m" onChange={(minutes) => editChore(c.id, { minutes })} />
            </View>
            <View style={s.cell}>
              <Text style={s.label}>Times a week</Text>
              <Stepper value={c.per_week} min={1} max={7} onChange={(per_week) => editChore(c.id, { per_week })} />
            </View>
            <View style={s.cell}>
              <Text style={s.label}>Effort</Text>
              <Pressable onPress={() => editChore(c.id, { effort: (c.effort % 3) + 1 })} style={s.effort}>
                <Text style={s.effortText}>{EFFORT[c.effort]}</Text>
              </Pressable>
            </View>
            <View style={s.cell}>
              <Text style={s.label}>Youngest age</Text>
              <Stepper value={c.min_age} min={0} max={18} onChange={(min_age) => editChore(c.id, { min_age })} />
            </View>
          </View>
          <Text style={s.check}>
            📸 Photo check: {c.check.mode === 'show' ? 'should show ' : 'no more '}
            <Text style={{ fontWeight: '700' }}>{c.check.look_for.join(', ')}</Text>
            {c.check.spot ? ` · same ${c.check.spot} in both photos` : ''}
          </Text>
        </Card>
      ))}

      <Section>Anything the planner should know?</Section>
      <Input multiline value={notes} onChangeText={setNotes} placeholder="Ali has exams on Thursday. Zara has football on Wednesdays." />

      <Button label={busy === 'save' ? 'Sharing out the week…' : 'Share out the chores'} onPress={save} loading={busy === 'save'} />
      {hh.chores.length > 0 && <Button label="Cancel" kind="ghost" onPress={() => router.back()} style={{ marginTop: 10 }} />}
    </Screen>
  );
}

const s = StyleSheet.create({
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.ink, marginBottom: 4 },
  story: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    minHeight: 110,
    fontSize: 15,
    color: colors.ink,
    marginVertical: 12,
    textAlignVertical: 'top',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameInput: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.ink, paddingVertical: 6 },
  customInput: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: 12, fontSize: 15, fontWeight: '500' },
  remove: { fontSize: 18, color: colors.muted, paddingHorizontal: 4 },
  label: { fontSize: 13, fontWeight: '700', color: colors.muted, flexShrink: 1 },
  days: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, backgroundColor: colors.lagoonSoft, borderRadius: 12, paddingVertical: 8, alignItems: 'center' },
  dayName: { fontSize: 11, fontWeight: '800', color: colors.muted },
  dayMins: { fontSize: 13, fontWeight: '800', color: colors.lagoon, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  cell: { width: '47%', gap: 6 },
  effort: { backgroundColor: colors.bg, borderRadius: 12, height: 36, alignItems: 'center', justifyContent: 'center' },
  effortText: { fontWeight: '700', color: colors.lagoon },
  check: { fontSize: 13, color: colors.muted, marginTop: 12, lineHeight: 19 },
});
