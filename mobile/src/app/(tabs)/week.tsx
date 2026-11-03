import { router } from 'expo-router';
import { CalendarDays, Check, ChevronRight, Eye, History } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Chip, FairnessBars, HScroll, IconButton, PersonTile, Screen, Sheet, TextLink, TintCard, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useHousehold } from '@/lib/session';
import { DAYS, dayDate, personColourOrder, personTone, radius, shiftWeek, useTheme, weekName, weekRange } from '@/lib/theme';
import type { WeekView } from '@/lib/types';
import { useRefresher } from '@/lib/useRefresher';

export default function Week() {
  const { c, dark, shadow } = useTheme();
  const { hh } = useHousehold();
  const { refreshing, reload } = useRefresher();
  const [day, setDay] = useState(hh?.today ?? 0);
  const [picking, setPicking] = useState(false);
  // null = this week, straight from the household. otherwise a saved past week or next week's preview
  const [other, setOther] = useState<string | null>(null);
  const [cache, setCache] = useState<Record<string, WeekView>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (hh) setDay(hh.today);
    setOther(null);
    setCache({});
  }, [hh?.week]);

  if (!hh) return null;

  const next = shiftWeek(hh.week, 1);
  const choices = [next, hh.week, ...(hh.past_weeks ?? []).filter((w) => w !== hh.week)];

  async function pick(week: string) {
    setPicking(false);
    setError('');
    if (week === hh!.week) {
      setOther(null);
      setDay(hh!.today);
      return;
    }
    setOther(week);
    setDay(0);
    // next week's preview depends on the current plan, so always fetch it fresh
    if (cache[week] && week !== next) return;
    setLoading(true);
    try {
      const view = await api.week(hh!.id, week);
      setCache((cs) => ({ ...cs, [week]: view }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const view: WeekView | null = other ? cache[other] ?? null : null;
  const current = !other;
  const week = other ?? hh.week;
  const tasks = current ? hh.tasks : view?.tasks ?? [];
  const board = current ? hh.board : view?.board ?? [];
  const fairness = current ? hh.fairness : view?.fairness ?? 0;
  const summary = current ? hh.summary : view?.summary;

  // past weeks keep their own names, in case someone left or a chore was renamed since
  const names: Record<string, string> = Object.fromEntries([...(view?.members ?? []), ...hh.members].map((m) => [m.id, m.name]));
  const chores: Record<string, { name: string; minutes: number }> = Object.fromEntries([...(view?.chores ?? []), ...hh.chores].map((x) => [x.id, x]));
  const tone = (id: string) => {
    if (hh.members.some((m) => m.id === id)) return personTone(c, hh, id);
    const i = Math.max(0, (view?.members ?? []).findIndex((m) => m.id === id));
    return c[personColourOrder[i % personColourOrder.length]];
  };

  const rows = board
    .filter((r) => names[r.member])
    .map((r) => ({ key: r.member, name: names[r.member], tone: tone(r.member), pct: r.free ? r.minutes / r.free : 0 }));
  const scale = Math.max(...rows.map((r) => r.pct), 0.01) * 1.3;
  const dayTasks = tasks.filter((t) => t.day === day);
  const done = tasks.filter((t) => t.status === 'done').length;

  return (
    <Screen tab onRefresh={reload} refreshing={refreshing}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <Txt v="titleTab">{weekName(week, hh.week)}</Txt>
          <Txt v="caption">{weekRange(week)}</Txt>
        </View>
        <IconButton icon={CalendarDays} label="Pick a week" onPress={() => setPicking(true)} bg={c.surface} iconSize={18} style={shadow} />
      </View>

      {!current && (
        <TintCard tone={view?.kind === 'next' || other === next ? 'ai' : 'blue'} style={{ marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {other === next ? <Eye size={16} color={c.ai.ink} strokeWidth={2} /> : <History size={16} color={c.blue.ink} strokeWidth={2} />}
          <View style={{ flex: 1 }}>
            <Txt v="caption" color={other === next ? c.ai.ink : c.blue.ink}>
              {other === next
                ? 'Preview from today\'s household. The real plan is made on Monday morning, when Muse Spark gets a say too.'
                : `Looking back. ${done} of ${tasks.length} chores were done.`}
            </Txt>
          </View>
          <TextLink label="This week" onPress={() => pick(hh.week)} color={other === next ? c.ai.ink : c.blue.ink} />
        </TintCard>
      )}

      {loading ? (
        <View style={{ paddingVertical: 60, alignItems: 'center' }}>
          <ActivityIndicator color={c.textMuted} />
        </View>
      ) : error ? (
        <TintCard tone="coral">
          <Txt v="body" color={c.coral.ink}>
            {error}
          </Txt>
        </TintCard>
      ) : (
        <>
          <View style={{ backgroundColor: c.panel, borderRadius: radius.card, padding: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <View>
                <Txt v="caption">Fairness</Txt>
                <Txt v="score" color={dark ? c.primary : c.text}>
                  {Math.round(fairness * 100)}%
                </Txt>
              </View>
              <Txt v="caption" style={{ textAlign: 'right', flex: 1, maxWidth: 170, marginTop: 14 }}>
                Share of free time each person spends on chores
              </Txt>
            </View>
            <FairnessBars rows={rows.map((r) => ({ ...r, scale }))} />
            {summary ? (
              <Txt v="caption" style={{ marginTop: 14 }}>
                {summary}
              </Txt>
            ) : null}
          </View>

          <HScroll style={{ marginTop: 18, marginBottom: 14 }}>
            {DAYS.map((d, i) => (
              <Chip key={d} label={`${d} ${dayDate(week, i).getDate()}`} selected={i === day} onPress={() => setDay(i)} />
            ))}
          </HScroll>

          {dayTasks.length === 0 ? (
            <Txt v="caption" style={{ marginLeft: 4 }}>
              Nothing planned this day.
            </Txt>
          ) : (
            <View>
              {/* dotted line behind the tiles */}
              <View style={{ position: 'absolute', left: 21, top: 22, bottom: 22, borderLeftWidth: 1.5, borderStyle: 'dashed', borderColor: c.borderStrong }} />
              {dayTasks.map((t) => {
                const chore = chores[t.chore];
                const who = names[t.member];
                if (!chore || !who) return null;
                const tn = tone(t.member);
                const isDone = t.status === 'done';
                const missed = !isDone && (other ? other < hh.week : day < hh.today);
                return (
                  <Pressable
                    key={t.id}
                    disabled={!current}
                    onPress={() => router.push({ pathname: '/chore/[id]', params: { id: t.id } })}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8, opacity: pressed ? 0.7 : missed ? 0.6 : 1 })}
                  >
                    <View style={{ backgroundColor: c.background, borderRadius: 14 }}>
                      <PersonTile name={who} tone={tn} size={44} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt v="caption" style={{ fontSize: 11 }}>
                        {chore.minutes} min
                        {t.status === 'started' ? ' · in progress' : t.status === 'retry' ? ' · needs a retake' : missed ? ' · not done' : ''}
                      </Txt>
                      <Txt v="bodyMedium" strike={isDone} color={isDone ? c.textMuted : c.text} numberOfLines={1}>
                        {chore.name}
                      </Txt>
                      <Txt v="caption" color={tn.ink} style={{ fontSize: 11 }}>
                        {who}
                      </Txt>
                    </View>
                    {isDone && (
                      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.success.strong, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Done">
                        <Check size={14} color="#FFFFFF" strokeWidth={2.5} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </>
      )}

      <Sheet visible={picking} onClose={() => setPicking(false)} title="Pick a week">
        <View style={{ gap: 8 }}>
          {choices.map((w) => {
            const on = w === week;
            return (
              <Pressable
                key={w}
                onPress={() => pick(w)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[
                  { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 16, borderRadius: radius.cardSmall, backgroundColor: c.surface, borderWidth: 1.5, borderColor: on ? c.primary : 'transparent' },
                  shadow,
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Txt v="bodyMedium">{weekName(w, hh.week)}</Txt>
                  <Txt v="caption">
                    {weekRange(w)}
                    {w === next ? ' · preview' : ''}
                  </Txt>
                </View>
                <ChevronRight size={18} color={c.textMuted} strokeWidth={2} />
              </Pressable>
            );
          })}
          {!(hh.past_weeks ?? []).length && (
            <Txt v="caption" center style={{ marginTop: 6 }}>
              Past weeks show up here once a week has finished.
            </Txt>
          )}
        </View>
      </Sheet>
    </Screen>
  );
}
