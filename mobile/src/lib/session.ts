import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { api } from './api';
import type { Household } from './types';

type Session = {
  hid: string | null;
  me: string | null;
  hh: Household | null;
  start: (hh: Household, me: string) => void;
  setHousehold: (hh: Household) => void;
  leave: () => void;
};

export const useSession = create<Session>()(
  persist(
    (set) => ({
      hid: null,
      me: null,
      hh: null,
      start: (hh, me) => set({ hid: hh.id, me, hh }),
      setHousehold: (hh) => set({ hh }),
      leave: () => set({ hid: null, me: null, hh: null }),
    }),
    {
      name: 'molakaz',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ hid: s.hid, me: s.me, hh: s.hh }),
    },
  ),
);

// wait for the saved session to load before deciding where to go
export function useHydrated() {
  const [done, setDone] = useState(useSession.persist.hasHydrated());
  useEffect(() => {
    const off = useSession.persist.onFinishHydration(() => setDone(true));
    setDone(useSession.persist.hasHydrated());
    return off;
  }, []);
  return done;
}

export async function refresh() {
  const { hid, setHousehold } = useSession.getState();
  if (!hid) return;
  setHousehold(await api.get(hid));
}

export function useHousehold() {
  const hh = useSession((s) => s.hh);
  const me = useSession((s) => s.me);
  const member = hh?.members.find((m) => m.id === me) ?? null;
  return { hh, me, member };
}
