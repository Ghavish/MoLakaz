import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Copy, Plus, Settings, Share2, X } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Pressable, Share, Text, View } from 'react-native';

import { SettingsSheet } from '@/components/SettingsSheet';
import { Button, Card, Chip, HScroll, IconButton, Input, ListCard, PersonTile, Screen, Txt } from '@/components/ui';
import { api, photoUrl } from '@/lib/api';
import { askForRetake } from '@/lib/mocks';
import { useHousehold, useSession } from '@/lib/session';
import { ask, dayLabel, font, freeLabel, personTone, radius, tell, timesLabel, useTheme } from '@/lib/theme';
import { useRefresher } from '@/lib/useRefresher';

type Tab = 'approvals' | 'notes' | 'people' | 'chores';

export default function Home() {
  const { c } = useTheme();
  const { hh, me, member } = useHousehold();
  const setHousehold = useSession((s) => s.setHousehold);
  const { refreshing, reload } = useRefresher();
  const [tab, setTab] = useState<Tab>('approvals');
  const [settings, setSettings] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!hh || !me || !member) return null;

  const admin = hh.members.find((m) => m.admin) ?? hh.members[0];
  const isAdmin = member.admin;
  const pending = hh.tasks.filter((t) => t.status === 'retry');
  const notes = (hh.notes || '').split('\n').map((n) => n.trim()).filter(Boolean);
  const fair = Math.round(hh.fairness * 100);

  async function approve(tid: string) {
    setBusy('approve:' + tid);
    try {
      setHousehold(await api.approve(hh!.id, tid, me!));
    } catch (e) {
      tell("That didn't work", (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function retake(name: string) {
    await askForRetake();
    tell('Retake requested', `We'll ask ${name} to snap the after photo again.`);
  }

  // notes are saved with the household setup, which re-plans the week
  function saveNotes(next: string[]) {
    ask('Update the notes?', 'The planner re-plans the rest of the week with them. Done chores stay put.', 'Save', async () => {
      setBusy('notes');
      try {
        setHousehold(await api.setup(hh!.id, me!, hh!.members, hh!.chores, next.join('\n')));
        setNote('');
      } catch (e) {
        tell("Couldn't save", (e as Error).message);
      } finally {
        setBusy(null);
      }
    });
  }

  async function copy() {
    await Clipboard.setStringAsync(hh!.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const stat = (value: string, label: string, tone: 'blue' | 'success' | 'amber') => (
    <View style={{ flex: 1, backgroundColor: c[tone].tint, borderRadius: radius.cardSmall, paddingVertical: 14, alignItems: 'center' }}>
      <Text style={{ fontFamily: font.semibold, fontSize: 20, color: c[tone].ink }}>{value}</Text>
      <Text style={{ fontFamily: font.medium, fontSize: 11, color: c[tone].ink }}>{label}</Text>
    </View>
  );

  return (
    <Screen tab onRefresh={reload} refreshing={refreshing}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <PersonTile name={admin?.name ?? hh.name} tone={personTone(c, hh, admin?.id ?? '')} size={72} round ring />
        <View style={{ flex: 1 }}>
          <Txt v="section" style={{ fontSize: 18 }} numberOfLines={1}>
            {hh.name}
          </Txt>
          <Txt v="caption">Run by {admin?.id === me ? 'you' : admin?.name}</Txt>
        </View>
        <IconButton icon={Settings} label="Settings" onPress={() => setSettings(true)} bg="transparent" iconSize={22} />
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        {stat(String(hh.members.length), 'People', 'blue')}
        {stat(String(hh.chores.length), 'Chores', 'success')}
        {stat(`${fair}%`, 'Fair', 'amber')}
      </View>

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 }}>
        <Txt v="caption">Join code</Txt>
        <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 16, letterSpacing: 4, color: c.text }}>{hh.code}</Text>
        <IconButton icon={Share2} label="Share the code" iconSize={16} size={40} onPress={() => Share.share({ message: `Join ${hh.name} on MoLakaz with the code ${hh.code}` }).catch(() => {})} />
        <IconButton icon={Copy} label={copied ? 'Copied' : 'Copy the code'} iconSize={16} size={40} onPress={copy} bg={copied ? c.success.tint : undefined} color={copied ? c.success.ink : undefined} />
      </Card>

      <HScroll style={{ marginTop: 16, marginBottom: 14 }}>
        {(
          [
            ['approvals', pending.length ? `Approvals · ${pending.length}` : 'Approvals'],
            ['notes', 'Notes'],
            ['people', 'People'],
            ['chores', 'Chores'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <Chip key={key} label={label} selected={tab === key} selectedKind="highlight" onPress={() => setTab(key)} />
        ))}
      </HScroll>

      {tab === 'approvals' &&
        (pending.length ? (
          pending.map((t) => {
            const who = hh.members.find((m) => m.id === t.member);
            const chore = hh.chores.find((x) => x.id === t.chore);
            if (!who || !chore) return null;
            const pic = photoUrl(t.check?.after_marked ?? t.after);
            return (
              <Card key={t.id} style={{ marginBottom: 10 }} onPress={() => router.push({ pathname: '/chore/[id]', params: { id: t.id } })}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ width: 52, height: 52, borderRadius: radius.avatarTile, backgroundColor: c.ai.tint, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                    {pic ? <Image source={{ uri: pic }} style={{ width: 52, height: 52 }} /> : <Txt v="label" color={c.ai.ink}>Photo</Txt>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: font.semibold, fontSize: 13.5, color: c.text }}>
                      <Text style={{ color: personTone(c, hh, who.id).ink }}>{who.name}</Text> · {chore.name}
                    </Text>
                    <Txt v="caption">
                      {dayLabel(hh, t.day)} · {t.check?.reason ?? "The photo check wasn't sure."} Can you look?
                    </Txt>
                  </View>
                </View>
                {isAdmin ? (
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <Button label="Approve" small onPress={() => approve(t.id)} loading={busy === 'approve:' + t.id} style={{ flex: 1 }} />
                    <Button label="Ask for a retake" kind="outline" small onPress={() => retake(who.name)} style={{ flex: 1 }} />
                  </View>
                ) : null}
              </Card>
            );
          })
        ) : (
          <Card>
            <Txt v="body" muted>
              Nothing to approve. When a photo check isn't sure, it lands here{isAdmin ? ' for you to look at' : ` for ${admin?.name} to look at`}.
            </Txt>
          </Card>
        ))}

      {tab === 'notes' && (
        <>
          {notes.length ? (
            <ListCard style={{ marginBottom: 12 }}>
              {notes.map((n, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 8 }}>
                  <Txt v="body" style={{ flex: 1, fontSize: 14 }}>
                    {n}
                  </Txt>
                  {isAdmin && <IconButton icon={X} label="Remove note" size={32} iconSize={14} onPress={() => saveNotes(notes.filter((_, j) => j !== i))} />}
                </View>
              ))}
            </ListCard>
          ) : (
            <Card style={{ marginBottom: 12 }}>
              <Txt v="body" muted>
                No notes yet. Notes like "John has exams on Thursday" go to Muse Spark with the weekly plan.
              </Txt>
            </Card>
          )}
          {isAdmin && (
            <>
              <Input value={note} onChangeText={setNote} placeholder="Sara has football on Wednesdays" onSubmitEditing={() => note.trim() && saveNotes([...notes, note.trim()])} />
              <Button label="Add a note" kind="outline" icon={Plus} onPress={() => saveNotes([...notes, note.trim()])} disabled={!note.trim()} loading={busy === 'notes'} />
            </>
          )}
        </>
      )}

      {tab === 'people' && (
        <>
          <ListCard>
            {hh.members.map((m) => (
              <Pressable key={m.id} disabled={!isAdmin} onPress={() => router.push('/review')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8 }}>
                <PersonTile name={m.name} tone={personTone(c, hh, m.id)} size={36} />
                <View style={{ flex: 1 }}>
                  <Txt v="bodyMedium">
                    {m.name}
                    {m.id === me ? ' (you)' : ''}
                  </Txt>
                  <Txt v="caption">{m.admin ? 'Runs the home' : `Age ${m.age}`}</Txt>
                </View>
                <Txt v="caption">{freeLabel(Math.round(m.free.reduce((a, b) => a + b, 0) / 7 / 15) * 15)}</Txt>
              </Pressable>
            ))}
          </ListCard>
          {isAdmin && <Button label="Edit people" kind="outline" onPress={() => router.push('/review')} style={{ marginTop: 12 }} />}
        </>
      )}

      {tab === 'chores' && (
        <>
          <ListCard>
            {hh.chores.map((x) => (
              <Pressable key={x.id} disabled={!isAdmin} onPress={() => router.push('/review')} style={{ minHeight: 56, paddingVertical: 10, justifyContent: 'center' }}>
                <Txt v="bodyMedium">{x.name}</Txt>
                <Txt v="caption">
                  {timesLabel(x.per_week)} · {x.minutes} min
                </Txt>
              </Pressable>
            ))}
          </ListCard>
          {isAdmin && <Button label="Edit chores" kind="outline" onPress={() => router.push('/review')} style={{ marginTop: 12 }} />}
        </>
      )}

      <SettingsSheet visible={settings} onClose={() => setSettings(false)} />
    </Screen>
  );
}
