import { router } from 'expo-router';
import { CalendarDays, Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Chip, FairnessBars, HScroll, IconButton, PersonTile, Screen, Txt } from '@/components/ui';
import { useHousehold } from '@/lib/session';
import { DAYS, dayDate, personTone, radius, useTheme, weekRange } from '@/lib/theme';
import { useRefresher } from '@/lib/useRefresher';

export default function Week() {
  const { c, dark, shadow } = useTheme();
  const { hh } = useHousehold();
  const { refreshing, reload } = useRefresher();
  const [day, setDay] = useState(hh?.today ?? 0);

  useEffect(() => {
    if (hh) setDay(hh.today);
  }, [hh?.week]);

  if (!hh) return null;

  const fair = Math.round(hh.fairness * 100);
  // share of each person's free time that goes on chores
  const rows = hh.board
    .map((r) => {
      const m = hh.members.find((x) => x.id === r.member);
      return m ? { key: m.id, name: m.name, tone: personTone(c, hh, m.id), pct: r.free ? r.minutes / r.free : 0 } : null;
    })
    .filter((r): r is NonNullable<typeof r> => !!r);
  const scale = Math.max(...rows.map((r) => r.pct), 0.01) * 1.3;
  const tasks = hh.tasks.filter((t) => t.day === day);

  return (
    <Screen tab onRefresh={reload} refreshing={refreshing}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <Txt v="titleTab">This week</Txt>
          <Txt v="caption">{weekRange(hh.week)}</Txt>
        </View>
        <IconButton icon={CalendarDays} label="Back to today" onPress={() => setDay(hh.today)} bg={c.surface} iconSize={18} style={shadow} />
      </View>

      <View style={{ backgroundColor: c.panel, borderRadius: radius.card, padding: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <View>
            <Txt v="caption">Fairness</Txt>
            <Txt v="score" color={dark ? c.primary : c.text}>
              {fair}%
            </Txt>
          </View>
          <Txt v="caption" style={{ textAlign: 'right', flex: 1, maxWidth: 170, marginTop: 14 }}>
            Share of free time each person spends on chores
          </Txt>
        </View>
        <FairnessBars rows={rows.map((r) => ({ ...r, scale }))} />
        {hh.summary ? (
          <Txt v="caption" style={{ marginTop: 14 }}>
            {hh.summary}
          </Txt>
        ) : null}
      </View>

      <HScroll style={{ marginTop: 18, marginBottom: 14 }}>
        {DAYS.map((d, i) => (
          <Chip key={d} label={`${d} ${dayDate(hh.week, i).getDate()}`} selected={i === day} onPress={() => setDay(i)} />
        ))}
      </HScroll>

      {tasks.length === 0 ? (
        <Txt v="caption" style={{ marginLeft: 4 }}>
          Nothing planned this day.
        </Txt>
      ) : (
        <View>
          {/* dotted line behind the tiles */}
          <View style={{ position: 'absolute', left: 21, top: 22, bottom: 22, borderLeftWidth: 1.5, borderStyle: 'dashed', borderColor: c.borderStrong }} />
          {tasks.map((t) => {
            const who = hh.members.find((m) => m.id === t.member);
            const chore = hh.chores.find((x) => x.id === t.chore);
            if (!who || !chore) return null;
            const tone = personTone(c, hh, who.id);
            const done = t.status === 'done';
            return (
              <Pressable
                key={t.id}
                onPress={() => router.push({ pathname: '/chore/[id]', params: { id: t.id } })}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8, opacity: pressed ? 0.7 : day < hh.today && !done ? 0.6 : 1 })}
              >
                <View style={{ backgroundColor: c.background, borderRadius: 14 }}>
                  <PersonTile name={who.name} tone={tone} size={44} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt v="caption" style={{ fontSize: 11 }}>
                    {chore.minutes} min{t.status === 'started' ? ' · in progress' : t.status === 'retry' ? ' · needs a retake' : ''}
                  </Txt>
                  <Txt v="bodyMedium" strike={done} color={done ? c.textMuted : c.text} numberOfLines={1}>
                    {chore.name}
                  </Txt>
                  <Txt v="caption" color={tone.ink} style={{ fontSize: 11 }}>
                    {who.name}
                  </Txt>
                </View>
                {done && (
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.success.strong, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Done">
                    <Check size={14} color="#FFFFFF" strokeWidth={2.5} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
