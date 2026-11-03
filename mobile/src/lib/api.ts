import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import type { AssistantChanges, Chore, CheckResult, Household, Member, WeekView } from './types';

// your modal url (https://<workspace>--molakaz-web.modal.run) or the local backend, see .env
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export function photoUrl(path?: string | null) {
  if (!path) return undefined;
  return path.startsWith('http') ? path : API_URL + path;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function call<T>(path: string, init: RequestInit = {}, what = ''): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body && !(init.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(API_URL + path, { ...init, headers });
  } catch (e) {
    // fetch only throws when no answer came back at all. say why, so it's clear what to fix
    const why = (e as Error)?.message ? ` (${(e as Error).message})` : '';
    if (what) throw new ApiError(`Couldn't send the ${what} to MoLakaz at ${API_URL}${why}. Try again.`, 0);
    throw new ApiError(`Can't reach MoLakaz at ${API_URL}${why}. Is the backend running?`, 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.detail || `Something went wrong (${res.status})`, res.status);
  return data as T;
}

// react native only uploads a file when its uri has a scheme. some recorders hand back a bare path
export function fileUri(uri: string) {
  return /^[a-z][a-z0-9+.-]*:/i.test(uri) ? uri : 'file://' + (uri.startsWith('/') ? '' : '/') + uri;
}

const post = <T>(path: string, body: unknown) => call<T>(path, { method: 'POST', body: JSON.stringify(body) });

async function attach(form: FormData, field: string, uri: string, name: string, type: string) {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    form.append(field, blob, name);
  } else {
    // expo's fetch (the default since sdk 52) doesn't take react native's { uri, name, type } file parts and fails with
    // "Unsupported FormDataPart implementation". it does take an expo-file-system File, which it reads the bytes from.
    form.append(field, new File(fileUri(uri)) as unknown as Blob);
  }
}

async function upload<T>(path: string, uri: string, memberId: string) {
  const form = new FormData();
  form.append('member_id', memberId);
  await attach(form, 'photo', uri, 'photo.jpg', 'image/jpeg');
  return call<T>(path, { method: 'POST', body: form }, 'photo');
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
  return call<{ text: string; seconds: number }>('/transcribe', { method: 'POST', body: form }, 'recording');
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
