import { create } from 'zustand';

import type { Draft } from './api';
import type { ActionSummary } from './mocks';

export type ChatMessage = { id: string; from: 'me' | 'assistant'; text: string; action?: ActionSummary; undone?: boolean };

// short-lived state passed between screens, not saved on the device
type Flow = {
  // what Muse Spark read from the household description, shown on Review before saving
  draft: Draft | null;
  setDraft: (d: Draft | null) => void;
  // dictated text waiting to go back into the Describe box
  dictation: string | null;
  setDictation: (t: string | null) => void;
  // a confirmed voice message waiting to be sent by the Assistant tab
  outbox: string | null;
  setOutbox: (t: string | null) => void;
  chat: ChatMessage[];
  setChat: (fn: (c: ChatMessage[]) => ChatMessage[]) => void;
};

export const useFlow = create<Flow>()((set) => ({
  draft: null,
  setDraft: (draft) => set({ draft }),
  dictation: null,
  setDictation: (dictation) => set({ dictation }),
  outbox: null,
  setOutbox: (outbox) => set({ outbox }),
  chat: [],
  setChat: (fn) => set((s) => ({ chat: fn(s.chat) })),
}));
