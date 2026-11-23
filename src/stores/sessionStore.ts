import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { kvStorage } from '../db/kv';
import type { ExerciseMeasure } from '../types/models';

/** Editable set values are kept as text so typing "72." isn't lost. Converted on save. */
export interface DraftSet {
  reps: string;
  weight: string;
  time: string;
  distance: string;
  done: boolean;
}

export interface DraftExercise {
  key: string;
  exerciseId: string;
  name: string;
  measure: ExerciseMeasure;
  restSec: number;
  timeUnit: 'sec' | 'min';
  target?: string;
  sets: DraftSet[];
}

/** The workout in progress. Persisted so a session survives the app being closed. */
export interface ActiveSession {
  editingId: string | null;
  templateId: string | null;
  name: string;
  startedAt: string;
  endedAt: string | null;
  exercises: DraftExercise[];
  notes: string;
}

interface SessionState {
  active: ActiveSession | null;
  start: (s: ActiveSession) => void;
  patch: (fn: (s: ActiveSession) => ActiveSession) => void;
  clear: () => void;
}

export const useWorkoutSession = create<SessionState>()(
  persist(
    (set) => ({
      active: null,
      start: (active) => set({ active }),
      patch: (fn) => set((st) => (st.active ? { active: fn(st.active) } : st)),
      clear: () => set({ active: null }),
    }),
    { name: 'knivy.workoutSession', storage: createJSONStorage(() => kvStorage) },
  ),
);

export const emptySet = (): DraftSet => ({ reps: '', weight: '', time: '', distance: '', done: false });
