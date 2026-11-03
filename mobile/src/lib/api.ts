import { Platform } from 'react-native';

import type { AssistantChanges, Chore, CheckResult, Household, Member, WeekView } from './types';

// your modal url (https://<workspace>--molakaz-web.modal.run) or the local backend, see .env
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export function photoUrl(path?: string | null) {
  if (!path) return undefined;
  return path.startsWith('http') ? path : API_URL + path;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body && !(init.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(API_URL + path, { ...init, headers });
  } catch {
    throw new Error(`Can't reach MoLakaz at ${API_URL}. Is the backend running?`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Something went wrong (${res.status})`);
  return data as T;
}

const post = <T>(path: string, body: unknown) => call<T>(path, { method: 'POST', body: JSON.stringify(body) });

async function attach(form: FormData, field: string, uri: string, name: string, type: string) {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    form.append(field, blob, name);
  } else {
    // react native's FormData takes a file like this
    form.append(field, { uri, name, type } as unknown as Blob);
  }
}

async function upload<T>(path: string, uri: string, memberId: string) {
  const form = new FormData();
  form.append('member_id', memberId);
  await attach(form, 'photo', uri, 'photo.jpg', 'image/jpeg');
  return call<T>(path, { method: 'POST', body: form });
}

// phones record m4a, browsers record webm
function audioFile(uri: string): [string, string] {
  const ext = (uri.split('?')[0].match(/\.(\w+)$/)?.[1] ?? (Platform.OS === 'web' ? 'webm' : 'm4a')).toLowerCase();
  const types: Record<string, string> = { m4a: 'audio/m4a', mp4: 'audio/mp4', aac: 'audio/aac', caf: 'audio/x-caf', wav: 'audio/wav', webm: 'audio/webm', '3gp': 'audio/3gpp' };
  return [`voice.${ext}`, types[ext] ?? 'application/octet-stream'];
}

async function transcribe(uri: string) {
  const form = new FormData();
  const [name, type] = audioFile(uri);
  await attach(form, 'audio', uri, name, type);
  return call<{ text: string; seconds: number }>('/transcribe', { method: 'POST', body: form });
}

export type Draft = { members: Member[]; chores: Chore[]; notes: string };

export const api = {
  health: () => call<{ ok: boolean; ai: boolean; gpu: boolean }>('/'),
  create: (name: string, yourName: string) =>
    post<{ household: Household; me: string }>('/households', { name, your_name: yourName }),
  join: (code: string) => call<Household>(`/join/${encodeURIComponent(code.trim())}`),
  get: (hid: string) => call<Household>(`/households/${hid}`),
  week: (hid: string, week: string) => call<WeekView>(`/households/${hid}/weeks/${week}`),
  setup: (hid: string, me: string, members: Member[], chores: Chore[], notes: string) =>
    call<Household>(`/households/${hid}/setup`, {
      method: 'PUT',
      body: JSON.stringify({ member_id: me, members, chores, notes }),
    }),
  plan: (hid: string, me: string) => post<Household>(`/households/${hid}/plan`, { member_id: me }),
  rebalance: (hid: string, me: string) => post<Household>(`/households/${hid}/rebalance`, { member_id: me }),
  away: (hid: string, me: string, day: number) => post<Household>(`/households/${hid}/away`, { member_id: me, day }),
  skip: (hid: string, tid: string, me: string) => post<Household>(`/households/${hid}/tasks/${tid}/skip`, { member_id: me }),
  approve: (hid: string, tid: string, me: string) =>
    post<Household>(`/households/${hid}/tasks/${tid}/approve`, { member_id: me }),
  before: (hid: string, tid: string, me: string, uri: string) =>
    upload<Household>(`/households/${hid}/tasks/${tid}/before`, uri, me),
  after: (hid: string, tid: string, me: string, uri: string) =>
    upload<{ household: Household; check: CheckResult }>(`/households/${hid}/tasks/${tid}/after`, uri, me),
  pushToken: (hid: string, me: string, token: string) =>
    post<{ ok: boolean }>(`/households/${hid}/push`, { member_id: me, token }),
  readHousehold: (text: string) => post<Draft>('/ai/setup', { text }),
  suggestChore: (name: string) => post<Chore>('/ai/chore', { text: name }),
  transcribe,
  assistant: (hid: string, me: string, text: string, history: { from: 'me' | 'assistant'; text: string }[]) =>
    post<{ reply: string; changes: AssistantChanges | null; household: Household }>(`/households/${hid}/assistant`, { member_id: me, text, history }),
  assistantUndo: (hid: string, me: string, changeId: string) =>
    post<Household>(`/households/${hid}/assistant/undo`, { member_id: me, change_id: changeId }),
  warmTranscriber: () => post<{ ok: boolean }>('/transcribe/warm', {}),
};
