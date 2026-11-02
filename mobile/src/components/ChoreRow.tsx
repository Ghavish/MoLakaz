import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Household, Task } from '@/lib/types';
import { colors, memberColor } from '@/lib/theme';
import { Avatar, Emoji, Pill } from './ui';

export function StatusPill({ status }: { status: Task['status'] }) {
  if (status === 'done') return <Pill label="Done ✓" color={colors.good} bg={colors.goodSoft} />;
  if (status === 'started') return <Pill label="In progress" color="#9A6A00" bg={colors.sunSoft} />;
  if (status === 'retry') return <Pill label="Try again" color={colors.coral} bg={colors.coralSoft} />;
  return <Pill label="To do" color={colors.muted} bg="#EEF1F3" />;
}

export function ChoreRow({ hh, task, showWho = false, faded = false }: {
  hh: Household;
  task: Task;
  showWho?: boolean;
  faded?: boolean;
}) {
  const chore = hh.chores.find((c) => c.id === task.chore);
  const who = hh.members.find((m) => m.id === task.member);
  if (!chore) return null;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
      style={({ pressed }) => [s.row, { opacity: faded ? 0.55 : pressed ? 0.75 : 1 }]}
    >
      <Emoji icon={chore.icon} />
      <View style={{ flex: 1 }}>
        <Text style={[s.name, task.status === 'done' && s.done]} numberOfLines={1}>
          {chore.name}
        </Text>
        <Text style={s.meta} numberOfLines={1}>
          {chore.minutes} min{task.carried ? ' · carried over' : ''}{task.tight ? ' · squeezed in' : ''}
        </Text>
      </View>
      {showWho && who ? (
        <View style={s.who}>
          <Avatar name={who.name} color={memberColor(hh, who.id)} size={26} />
        </View>
      ) : null}
      <StatusPill status={task.status} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.line,
  },
  name: { fontSize: 16, fontWeight: '700', color: colors.ink },
  done: { textDecorationLine: 'line-through', color: colors.muted },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  who: { marginRight: 2 },
});
