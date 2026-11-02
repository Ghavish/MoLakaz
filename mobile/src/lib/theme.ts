import { Alert, Platform } from 'react-native';

import type { Household } from './types';

export const colors = {
  bg: '#FBF6EE',
  card: '#FFFFFF',
  ink: '#1F2A2E',
  muted: '#6B7680',
  line: '#ECE4D6',
  lagoon: '#0E7C7B',
  lagoonSoft: '#D9F0ED',
  coral: '#F2725C',
  coralSoft: '#FDE6E0',
  sun: '#F6B83C',
  sunSoft: '#FEF1D6',
  good: '#2E9E6A',
  goodSoft: '#DDF3E8',
};

const people = ['#0E7C7B', '#F2725C', '#7C5CC4', '#E09A1A', '#2E86DE', '#D6457A', '#3BA55C', '#8D6E63'];

export function memberColor(hh: Household | null, id: string) {
  const i = hh ? hh.members.findIndex((m) => m.id === id) : 0;
  return people[Math.max(i, 0) % people.length];
}

export const choreEmoji: Record<string, string> = {
  dishes: '🍽️',
  table: '🧽',
  sweep: '🧹',
  trash: '🗑️',
  tidy: '🛋️',
  laundry: '👕',
  bathroom: '🚿',
  cook: '🍲',
  yard: '🍂',
  bed: '🛏️',
  other: '✨',
};

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const LONG_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function dateOf(week: string, day: number) {
  const d = new Date(week + 'T00:00:00');
  d.setDate(d.getDate() + day);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function dayLabel(hh: Household, day: number) {
  if (day === hh.today) return 'Today';
  if (day === hh.today + 1) return 'Tomorrow';
  return LONG_DAYS[day];
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
