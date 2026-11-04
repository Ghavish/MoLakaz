import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo } from 'react';
import { Alert, Platform, useColorScheme } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Household } from './types';

// single source of truth for both modes, from the design handoff
export const palette = {
  dark: {
    background: '#111111',
    surface: '#1C1C1C',
    surfaceSubtle: '#171717',
    surfaceRaised: '#2A2A2A',
    tabBar: '#151515',
    panel: '#1C1C1C',
    heroCard: '#1C1C1C',
    onHero: '#F5F2EE',
    border: 'rgba(255,255,255,0.07)',
    borderStrong: 'rgba(255,255,255,0.15)',
    text: '#F5F2EE',
    textSecondary: '#D8D3CC',
    textMuted: '#A3A09B',
    textFaint: '#8C8984',
    primary: '#F5A66E',
    onPrimary: '#1A120B',
    highlight: '#F2EDE6',
    onHighlight: '#161412',
    mess: '#F5A66E',
    script: '#F5A66E',
    overlay: 'rgba(0,0,0,0.6)',
    success: { strong: '#2FD39E', tint: '#15332A', ink: '#8EEBC9' },
    ai: { strong: '#A88BFF', tint: '#2A2142', ink: '#CDBDFF' },
    amber: { strong: '#F5B041', tint: '#3A2E16', ink: '#FFD58A' },
    blue: { strong: '#5B8CFF', tint: '#1A2540', ink: '#A9C2FF' },
    coral: { strong: '#FF8A6B', tint: '#3A211B', ink: '#FFB39E' },
  },
  light: {
    background: '#F2F3F6',
    surface: '#FFFFFF',
    surfaceSubtle: '#F7F8FA',
    surfaceRaised: '#EEF2F8',
    tabBar: '#FFFFFF',
    panel: '#DCE7F7',
    heroCard: '#0E1E3A',
    onHero: '#FFFFFF',
    border: 'rgba(14,30,58,0.07)',
    borderStrong: 'rgba(14,30,58,0.15)',
    text: '#0E1E3A',
    textSecondary: '#3A4659',
    textMuted: '#5F6B7E',
    textFaint: '#6B7688',
    primary: '#0E1E3A',
    onPrimary: '#FFFFFF',
    highlight: '#0E1E3A',
    onHighlight: '#FFFFFF',
    mess: '#D9692A',
    script: '#E8603C',
    overlay: 'rgba(14,30,58,0.35)',
    success: { strong: '#1FB585', tint: '#DDF6EC', ink: '#047857' },
    ai: { strong: '#8E6CF0', tint: '#EEE8FF', ink: '#6D28D9' },
    amber: { strong: '#F5A623', tint: '#FFF1D6', ink: '#B45309' },
    blue: { strong: '#3D7BF0', tint: '#E1EBFF', ink: '#1D4ED8' },
    coral: { strong: '#FF7A59', tint: '#FFE6DE', ink: '#C2410C' },
  },
};

export type Colors = (typeof palette)['dark'];
export type Tone = { strong: string; tint: string; ink: string };
export type ToneName = 'success' | 'ai' | 'amber' | 'blue' | 'coral';

// one colour per person, up to 10 people. no purple (that's the assistant) and no green (that means done).
// each person keeps theirs: the backend stores it as member.color, an index into this list
const tone = (strong: string, tint: string, ink: string): Tone => ({ strong, tint, ink });
export const personPalette = {
  light: [
    tone('#FF7A59', '#FFE6DE', '#AD3A0B'), // coral
    tone('#F5A623', '#FFF1D6', '#9A4A08'), // amber
    tone('#3D7BF0', '#E1EBFF', '#1D4ED8'), // blue
    tone('#E4579B', '#FDE4F0', '#BE185D'), // pink
    tone('#14A3A3', '#D7F5F4', '#0F766E'), // teal
    tone('#2BA6DE', '#DDF2FC', '#0369A1'), // sky
    tone('#7CB518', '#EDF7D6', '#3F6A0C'), // lime
    tone('#A8714A', '#F5E8DE', '#8A4B22'), // cocoa
    tone('#64748B', '#E7EBF0', '#334155'), // slate
    tone('#D63D5A', '#FCE3E8', '#B91C3C'), // crimson
  ],
  dark: [
    tone('#FF8A6B', '#3A211B', '#FFB39E'),
    tone('#F5B041', '#3A2E16', '#FFD58A'),
    tone('#5B8CFF', '#1A2540', '#A9C2FF'),
    tone('#F27AB4', '#3B1C2C', '#F9B4D6'),
    tone('#2CC4C4', '#123333', '#8DE5E3'),
    tone('#5CC3EE', '#14293A', '#A5DDF5'),
    tone('#9CD23A', '#243013', '#C9EA8C'),
    tone('#C99270', '#33241A', '#E7C3A9'),
    tone('#94A3B8', '#22272F', '#CBD5E1'),
    tone('#F0647D', '#3A1A20', '#F8A9B7'),
  ],
};
export const MAX_MEMBERS = personPalette.light.length;

export const radius = { card: 22, cardSmall: 18, button: 28, chip: 18, tile: 14, avatarTile: 12 };
export const space = { screenX: 24, screenTop: 28, gapS: 8, gapM: 12, gapL: 16, section: 22 };
export const cardShadowLight = {
  shadowColor: '#0E1E3A',
  shadowOpacity: 0.06,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
};

export const font = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  script: 'MrsSaintDelafield_400Regular',
};

// theme override, kept on the device
export type ThemePref = 'system' | 'light' | 'dark';

export const usePrefs = create<{ themePref: ThemePref; setThemePref: (p: ThemePref) => void }>()(
  persist(
    (set) => ({
      themePref: 'system',
      setThemePref: (themePref) => set({ themePref }),
    }),
    { name: 'molakaz-prefs', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

const NO_SHADOW = {};

export type Theme = { c: Colors; dark: boolean; shadow: object };

export function useTheme() {
  const system = useColorScheme();
  const pref = usePrefs((s) => s.themePref);
  const setPref = usePrefs((s) => s.setThemePref);
  const dark = pref === 'system' ? system === 'dark' : pref === 'dark';
  const c = dark ? palette.dark : palette.light;
  return {
    c,
    dark,
    shadow: dark ? NO_SHADOW : cardShadowLight,
    pref,
    setPref,
    // the quick sun/moon button: flip to the opposite of what's showing
    toggle: () => setPref(dark ? 'light' : 'dark'),
  };
}

// styles that depend on the theme: const useStyles = makeStyles((t) => StyleSheet.create({...}))
export function makeStyles<T>(fn: (t: Theme) => T) {
  return function useStyles(): T {
    const { c, dark, shadow } = useTheme();
    return useMemo(() => fn({ c, dark, shadow }), [c, dark, shadow]);
  };
}

// same rule as the backend's assign_colors: keep stored colours, give anyone without one the lowest free colour.
// that way a person added in Review shows the colour they'll get once saved
export function memberColors(members: { id: string; color?: number | null }[]) {
  const out: Record<string, number> = {};
  const taken = new Set<number>();
  for (const m of members) {
    const c = m.color;
    if (typeof c === 'number' && c >= 0 && c < MAX_MEMBERS && !taken.has(c)) {
      out[m.id] = c;
      taken.add(c);
    }
  }
  for (const m of members) {
    if (out[m.id] !== undefined) continue;
    let free = 0;
    while (taken.has(free) && free < MAX_MEMBERS) free++;
    out[m.id] = free % MAX_MEMBERS;
    taken.add(free);
  }
  return out;
}

export function toneFor(c: Colors, members: { id: string; color?: number | null }[], id: string): Tone {
  const list = c === palette.dark ? personPalette.dark : personPalette.light;
  return list[memberColors(members)[id] ?? 0];
}

export function personTone(c: Colors, hh: Household | null, id: string): Tone {
  return toneFor(c, hh?.members ?? [], id);
}

export function usePersonTone(hh: Household | null) {
  const { c } = useTheme();
  return (id: string) => personTone(c, hh, id);
}

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const LONG_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function dayDate(week: string, day: number) {
  const d = new Date(week + 'T00:00:00');
  d.setDate(d.getDate() + day);
  return d;
}

export function dateOf(week: string, day: number) {
  return dayDate(week, day).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
}

export function weekRange(week: string) {
  const a = dayDate(week, 0);
  const b = dayDate(week, 6);
  const month = (d: Date) => d.toLocaleDateString(undefined, { month: 'long' });
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} – ${b.getDate()} ${month(b)}`
    : `${a.getDate()} ${month(a)} – ${b.getDate()} ${month(b)}`;
}

export function shiftWeek(week: string, weeks: number) {
  const d = dayDate(week, weeks * 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// "This week", "Last week", "Next week", or "3 weeks ago"
export function weekName(week: string, current: string) {
  const diff = Math.round((dayDate(week, 0).getTime() - dayDate(current, 0).getTime()) / (7 * 864e5));
  if (diff === 0) return 'This week';
  if (diff === -1) return 'Last week';
  if (diff === 1) return 'Next week';
  return diff < 0 ? `${-diff} weeks ago` : `In ${diff} weeks`;
}

export function dayLabel(hh: Household, day: number) {
  if (day === hh.today) return 'Today';
  if (day === hh.today + 1) return 'Tomorrow';
  return LONG_DAYS[day];
}

export function freeLabel(mins: number) {
  if (!mins) return 'No free time';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h ? h + 'h' : ''}${h && m ? ' ' : ''}${m ? m + 'm' : ''} a day`;
}

export function timesLabel(n: number) {
  if (n >= 7) return 'Every day';
  if (n === 1) return 'Once a week';
  if (n === 2) return 'Twice a week';
  return `${n} times a week`;
}

// Alert does nothing on web, so fall back to the browser one
export function tell(title: string, message = '') {
  if (Platform.OS === 'web') window.alert(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}

export function ask(title: string, message: string, yes: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: yes, onPress: onYes },
  ]);
}
