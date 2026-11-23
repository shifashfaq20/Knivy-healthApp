import * as LocalAuthentication from 'expo-local-authentication';
import { create } from 'zustand';

type Area = 'journal' | 'records';
const UNLOCK_MS = 5 * 60 * 1000;

interface LockState {
  unlockedUntil: Record<Area, number>;
  isUnlocked: (area: Area) => boolean;
  unlock: (area: Area) => Promise<{ ok: boolean; message?: string }>;
  lockAll: () => void;
}

export const useLock = create<LockState>()((set, get) => ({
  unlockedUntil: { journal: 0, records: 0 },
  isUnlocked: (area) => get().unlockedUntil[area] > Date.now(),
  unlock: async (area) => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !enrolled) {
      return { ok: false, message: 'Set up a passcode, fingerprint or Face ID on this phone to use the lock.' };
    }
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Knivy' });
    if (result.success) {
      set((s) => ({ unlockedUntil: { ...s.unlockedUntil, [area]: Date.now() + UNLOCK_MS } }));
      return { ok: true };
    }
    return { ok: false };
  },
  lockAll: () => set({ unlockedUntil: { journal: 0, records: 0 } }),
}));
