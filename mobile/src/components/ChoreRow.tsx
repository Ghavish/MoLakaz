import { router } from 'expo-router';
import { Camera, Check } from 'lucide-react-native';
import { View } from 'react-native';

import type { Chore, Household, Task } from '@/lib/types';
import { radius, useTheme } from '@/lib/theme';
import { Badge, Button, Card, ChoreIcon, Txt } from './ui';

export function StatusBadge({ status, onHero }: { status: Task['status']; onHero?: boolean }) {
  const { c, dark } = useTheme();
  if (status === 'done') return <Badge label="Done" tone="success" />;
  if (status === 'started') {
    // light mode hero card: bright amber with navy text
    return onHero && !dark ? <Badge label="In progress" bg="#FFC145" fg={c.text} /> : <Badge label="In progress" tone="amber" />;
  }
  if (status === 'retry') return <Badge label="Try again" tone="coral" />;
  return <Badge label="To do" bg={c.surfaceRaised} fg={c.textMuted} />;
}

export function choreMeta(chore: Chore, task: Task) {
  const bits = [`${chore.minutes} min`];
  if (chore.check.spot) bits.push(`Photo of the ${chore.check.spot}`);
  else if (chore.check.look_for[0]) bits.push(`Photo of the ${chore.check.look_for[0]}`);
  if (task.carried) bits.push('Carried over');
  if (task.tight) bits.push('Squeezed in');
  return bits.join(' · ');
}

export function clock(secs: number) {
  return new Date(secs * 1000).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const open = (id: string) => router.push({ pathname: '/chore/[id]', params: { id } });
const photo = (id: string, step: 'before' | 'after') => router.push({ pathname: '/chore/[id]/photo', params: { id, step } });

// the chore you're in the middle of: the navy hero card in light mode
export function HeroChore({ chore, task, onLongPress }: { chore: Chore; task: Task; onLongPress?: () => void }) {
  const { c, dark } = useTheme();
  return (
    <Card onPress={() => open(task.id)} onLongPress={onLongPress} style={{ backgroundColor: c.heroCard, marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Txt v="section" color={c.onHero}>
            {chore.name}
          </Txt>
          <Txt v="caption" color={dark ? c.textMuted : 'rgba(255,255,255,0.7)'}>
            {choreMeta(chore, task)}
          </Txt>
        </View>
        <StatusBadge status={task.status} onHero />
      </View>
      <Button
        label={task.status === 'retry' ? 'Retake the after photo' : 'Take the after photo'}
        icon={Camera}
        onPress={() => photo(task.id, 'after')}
        bg={dark ? c.primary : '#FFFFFF'}
        fg={dark ? c.onPrimary : c.text}
        small
        style={{ marginTop: 14, height: 48, borderRadius: 24 }}
      />
    </Card>
  );
}

export function ChoreCard({ chore, task, onLongPress }: { chore: Chore; task: Task; onLongPress?: () => void }) {
  const { c } = useTheme();
  const done = task.status === 'done';
  return (
    <Card
      small
      onPress={() => open(task.id)}
      onLongPress={onLongPress}
      style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10, paddingVertical: 14 }, done && { backgroundColor: c.surfaceSubtle }]}
    >
      <ChoreIcon icon={chore.icon} muted={done} />
      <View style={{ flex: 1 }}>
        <Txt v="bodyMedium" strike={done} color={done ? c.textMuted : c.text} numberOfLines={1}>
          {chore.name}
        </Txt>
        <Txt v="caption" numberOfLines={1}>
          {done ? `${task.check?.manual ? 'Approved' : 'Checked by photo'}${task.done_at ? ' at ' + clock(task.done_at) : ''}` : choreMeta(chore, task)}
        </Txt>
      </View>
      {done ? (
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.success.strong, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Done">
          <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
        </View>
      ) : (
        <Button label="Start" kind="outline" small onPress={() => photo(task.id, 'before')} style={{ height: 40, borderRadius: radius.chip + 2, paddingHorizontal: 16 }} />
      )}
    </Card>
  );
}
