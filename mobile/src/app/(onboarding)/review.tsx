import { router } from 'expo-router';
import { Camera, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Chip, choreTone, Header, Input, ListCard, PersonTile, Screen, Section, Segmented, Sheet, Stepper, TextLink, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useFlow } from '@/lib/flow';
import { useHousehold, useSession } from '@/lib/session';
import { DAYS, font, freeLabel, MAX_MEMBERS, personTone, radius, shiftTime, tell, timeLabel, timesLabel, useTheme } from '@/lib/theme';
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

function tempId() {
  return 'm_' + Math.random().toString(36).slice(2, 10);
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function Review() {
  const { c } = useTheme();
  const { hh, me } = useHousehold();
  const setHousehold = useSession((s) => s.setHousehold);
  const draft = useFlow((s) => s.draft);
  const setDraft = useFlow((s) => s.setDraft);

  const [members, setMembers] = useState<Member[]>([]);
  const [chores, setChores] = useState<Chore[]>([]);
  const [notes, setNotes] = useState('');
  const [person, setPerson] = useState<string | null>(null);
  const [chore, setChore] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!hh) return;
    setMembers(draft?.members ?? hh.members);
    setChores(draft?.chores ?? hh.chores);
    setNotes([hh.notes, draft?.notes].filter(Boolean).join('\n'));
  }, [hh?.id, draft]);

  if (!hh || !me) return null;

  const editMember = (id: string, patch: Partial<Member>) => setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const editChore = (id: string, patch: Partial<Chore>) => setChores((cs) => cs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const tone = (id: string) => personTone(c, { ...hh, members }, id);

  const editing = members.find((m) => m.id === person);
  const editingChore = chores.find((x) => x.id === chore);
  const firstTime = hh.chores.length === 0;

  function addPerson() {
    if (members.length >= MAX_MEMBERS) return tell(`A household can have up to ${MAX_MEMBERS} people`);
    const m: Member = { id: tempId(), name: '', age: 30, admin: false, free: [45, 45, 45, 45, 45, 120, 120], dislikes: [] };
    setMembers((ms) => [...ms, m]);
    setPerson(m.id);
  }

  async function addChore(name: string) {
    if (!name.trim()) return;
    if (chores.some((x) => x.name.toLowerCase() === name.trim().toLowerCase())) return;
    setBusy('chore:' + name);
    try {
      const made = await api.suggestChore(name.trim());
      setChores((cs) => [...cs, made]);
      setCustom('');
    } catch (e) {
      tell("Couldn't add that", (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    const named = members.filter((m) => m.name.trim());
    if (!named.length || !chores.length) return;
    setBusy('save');
    try {
      setHousehold(await api.setup(hh!.id, me!, named, chores, notes));
      setDraft(null);
      router.replace('/today');
    } catch (e) {
      tell("Couldn't save", (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const empty = !members.some((m) => m.name.trim()) || !chores.length;

  return (
    <Screen
      footer={
        <>
          {empty && (
            <Txt v="caption" center style={{ marginBottom: 8 }}>
              Add at least one person and one chore
            </Txt>
          )}
          <Button label={busy === 'save' ? 'Sharing out the week…' : firstTime ? 'Plan our first week' : 'Save and re-plan'} arrow onPress={save} loading={busy === 'save'} disabled={empty} />
        </>
      }
    >
      <Header onBack={firstTime ? () => router.replace('/describe') : undefined} />
      <Txt v="title">Your household</Txt>
      <Txt v="caption">Check what we set up. Tap anything to change it.</Txt>

      <Section right={members.length < MAX_MEMBERS ? <TextLink label="+ Add person" onPress={addPerson} /> : <Txt v="caption">{MAX_MEMBERS} people max</Txt>}>People</Section>
      <ListCard>
        {members.map((m) => (
          <Pressable key={m.id} onPress={() => setPerson(m.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8 }}>
            <PersonTile name={m.name || '?'} tone={tone(m.id)} size={36} />
            <View style={{ flex: 1 }}>
              <Txt v="bodyMedium" numberOfLines={1}>
                {m.name || 'New person'}
              </Txt>
              <Txt v="caption" numberOfLines={1}>
                {m.id === me ? 'You · runs the home' : m.admin ? 'Runs the home' : `Age ${m.age}${m.dislikes.length ? ` · would rather skip ${m.dislikes.length}` : ''}`}
              </Txt>
            </View>
            <Txt v="caption">{freeLabel(Math.round(m.free.reduce((a, b) => a + b, 0) / 7 / 15) * 15)}</Txt>
          </Pressable>
        ))}
      </ListCard>

      <Section right={<TextLink label="+ Add chore" onPress={() => setAdding(true)} />}>Chores</Section>
      {chores.length ? (
        <ListCard>
          {chores.map((x) => {
            const t = c[x.check.mode === 'show' ? 'ai' : choreTone(x.icon)];
            const what = cap(x.check.spot || x.check.look_for[0] || 'Photo');
            return (
              <Pressable key={x.id} onPress={() => setChore(x.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, paddingVertical: 8 }}>
                <View style={{ flex: 1 }}>
                  <Txt v="bodyMedium" numberOfLines={1}>
                    {x.name}
                  </Txt>
                  <Txt v="caption">
                    {timesLabel(x.per_week)} · {timeLabel(x.time)} · {x.minutes} min
                  </Txt>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: t.tint, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, maxWidth: 150 }}>
                  <Camera size={12} color={t.ink} strokeWidth={2} />
                  <Text style={{ fontFamily: font.medium, fontSize: 11, color: t.ink }} numberOfLines={1}>
                    {what}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ListCard>
      ) : (
        <Pressable onPress={() => setAdding(true)}>
          <View style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: c.borderStrong, borderRadius: radius.card, padding: 20, alignItems: 'center' }}>
            <Txt v="caption">No chores yet. Tap to add some.</Txt>
          </View>
        </Pressable>
      )}

      <Section>Anything the planner should know?</Section>
      <Input multiline value={notes} onChangeText={setNotes} placeholder="John has exams on Thursday. Sara has football on Wednesdays." />

      {/* person editor */}
      <Sheet visible={!!editing} onClose={() => setPerson(null)} title={editing?.name || 'New person'} footer={<Button label="Done" onPress={() => setPerson(null)} />}>
        {editing && (
          <>
            <Input label="Name" value={editing.name} onChangeText={(name) => editMember(editing.id, { name })} placeholder="Name" autoCapitalize="words" autoFocus={!editing.name} />
            <Txt v="caption" style={{ marginBottom: 6 }}>
              Age
            </Txt>
            <Stepper value={editing.age} min={1} max={99} onChange={(age) => editMember(editing.id, { age })} />
            <Txt v="caption" style={{ marginTop: 16, marginBottom: 6 }}>
              Free time for chores each day (tap to change)
            </Txt>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {editing.free.map((mins, d) => (
                <Pressable
                  key={d}
                  accessibilityLabel={`${DAYS[d]}: ${mins} minutes`}
                  onPress={() => {
                    const next = FREE_STEPS[(FREE_STEPS.indexOf(mins) + 1) % FREE_STEPS.length] ?? 0;
                    editMember(editing.id, { free: editing.free.map((v, i) => (i === d ? next : v)) });
                  }}
                  style={{ flex: 1, minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: mins ? c.blue.tint : c.surfaceRaised }}
                >
                  <Txt v="label" muted>
                    {DAYS[d][0]}
                  </Txt>
                  <Text style={{ fontFamily: font.semibold, fontSize: 12, color: mins ? c.blue.ink : c.textFaint, marginTop: 2 }}>{mins ? mins + 'm' : '–'}</Text>
                </Pressable>
              ))}
            </View>
            {chores.length > 0 && (
              <>
                <Txt v="caption" style={{ marginTop: 16, marginBottom: 8 }}>
                  Would rather not do
                </Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {chores.map((x) => {
                    const on = editing.dislikes.includes(x.id);
                    return (
                      <Chip
                        key={x.id}
                        label={x.name}
                        tone={on ? 'coral' : undefined}
                        onPress={() => editMember(editing.id, { dislikes: on ? editing.dislikes.filter((v) => v !== x.id) : [...editing.dislikes, x.id] })}
                      />
                    );
                  })}
                </View>
              </>
            )}
            {editing.id !== me && (
              <Button
                label="Remove from household"
                kind="outline"
                icon={Trash2}
                fg={c.coral.ink}
                onPress={() => {
                  setMembers((ms) => ms.filter((x) => x.id !== editing.id));
                  setPerson(null);
                }}
                style={{ marginTop: 22 }}
              />
            )}
          </>
        )}
      </Sheet>

      {/* chore editor */}
      <Sheet visible={!!editingChore} onClose={() => setChore(null)} title={editingChore?.name || 'Chore'} footer={<Button label="Done" onPress={() => setChore(null)} />}>
        {editingChore && (
          <>
            <Input label="Name" value={editingChore.name} onChangeText={(name) => editChore(editingChore.id, { name })} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
              <View style={{ gap: 6 }}>
                <Txt v="caption">Takes</Txt>
                <Stepper value={editingChore.minutes} step={5} min={5} max={240} suffix="m" onChange={(minutes) => editChore(editingChore.id, { minutes })} />
              </View>
              <View style={{ gap: 6 }}>
                <Txt v="caption">Times a week</Txt>
                <Stepper value={editingChore.per_week} min={1} max={7} onChange={(per_week) => editChore(editingChore.id, { per_week })} />
              </View>
              <View style={{ gap: 6 }}>
                <Txt v="caption">Youngest age</Txt>
                <Stepper value={editingChore.min_age} min={0} max={18} onChange={(min_age) => editChore(editingChore.id, { min_age })} />
              </View>
            </View>
            <Txt v="caption" style={{ marginTop: 16, marginBottom: 6 }}>
              Usual time
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surfaceRaised, borderRadius: 22, padding: 4 }}>
                <Pressable hitSlop={6} accessibilityLabel="Earlier" onPress={() => editChore(editingChore.id, { time: shiftTime(editingChore.time, -30) })} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: font.medium, fontSize: 18, color: c.text, marginTop: -1 }}>−</Text>
                </Pressable>
                <Text style={{ minWidth: 84, textAlign: 'center', fontFamily: font.semibold, fontSize: 14, color: editingChore.time ? c.text : c.textMuted }}>{timeLabel(editingChore.time)}</Text>
                <Pressable hitSlop={6} accessibilityLabel="Later" onPress={() => editChore(editingChore.id, { time: shiftTime(editingChore.time, 30) })} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: font.medium, fontSize: 18, color: c.text, marginTop: -1 }}>+</Text>
                </Pressable>
              </View>
              <Chip label="Anytime" selected={!editingChore.time} selectedKind="highlight" onPress={() => editChore(editingChore.id, { time: '' })} />
            </View>
            <Txt v="caption" style={{ marginTop: 16, marginBottom: 6 }}>
              Effort
            </Txt>
            <Segmented
              value={String(editingChore.effort)}
              onChange={(v) => editChore(editingChore.id, { effort: Number(v) })}
              options={[
                { value: '1', label: 'Easy' },
                { value: '2', label: 'Medium' },
                { value: '3', label: 'Hard' },
              ]}
            />
            <Txt v="section" style={{ marginTop: 22, marginBottom: 6 }}>
              Photo check
            </Txt>
            <Segmented
              value={editingChore.check.mode}
              onChange={(mode) => editChore(editingChore.id, { check: { ...editingChore.check, mode } })}
              options={[
                { value: 'clear', label: 'Mess is gone' },
                { value: 'show', label: 'Result shows' },
              ]}
            />
            <View style={{ height: 14 }} />
            <Input
              label={editingChore.check.mode === 'show' ? 'What the after photo should show' : 'Mess to look for (comma separated)'}
              value={editingChore.check.look_for.join(', ')}
              onChangeText={(t) => editChore(editingChore.id, { check: { ...editingChore.check, look_for: t.split(',').map((v) => v.trimStart()) } })}
              onBlur={() => editChore(editingChore.id, { check: { ...editingChore.check, look_for: editingChore.check.look_for.map((v) => v.trim()).filter(Boolean) } })}
              placeholder="dirty dish, cup, pan"
            />
            <Input label="Same spot in both photos (optional)" value={editingChore.check.spot} onChangeText={(spot) => editChore(editingChore.id, { check: { ...editingChore.check, spot } })} placeholder="sink" />
            <Button
              label="Remove chore"
              kind="outline"
              icon={Trash2}
              fg={c.coral.ink}
              onPress={() => {
                setChores((cs) => cs.filter((x) => x.id !== editingChore.id));
                setChore(null);
              }}
              style={{ marginTop: 8 }}
            />
          </>
        )}
      </Sheet>

      {/* add chore */}
      <Sheet visible={adding} onClose={() => setAdding(false)} title="Add a chore">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {QUICK.filter(([icon]) => !chores.some((x) => x.icon === icon)).map(([icon, name]) => (
            <Chip key={icon} label={busy === 'chore:' + name ? 'Adding…' : '+ ' + name} onPress={() => (busy ? undefined : addChore(name))} />
          ))}
        </View>
        <Input label="Something else" value={custom} onChangeText={setCustom} placeholder="Walk the dog" onSubmitEditing={() => addChore(custom)} />
        <Button label="Add" onPress={() => addChore(custom)} disabled={!custom.trim()} loading={busy === 'chore:' + custom.trim()} />
        <Txt v="caption" center style={{ marginTop: 10 }}>
          Muse Spark guesses the time and what to photograph. You can change it after.
        </Txt>
      </Sheet>
    </Screen>
  );
}
