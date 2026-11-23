import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { kvStorage } from '../db/kv';
import { DEFAULT_UNITS, type UnitPrefs } from '../utils/units';

export type WidgetId =
  | 'steps'
  | 'activity'
  | 'heart'
  | 'sleep'
  | 'nutrition'
  | 'water'
  | 'medications'
  | 'workout'
  | 'habits'
  | 'goals'
  | 'recent'
  | 'weekly';

export const WIDGETS: { id: WidgetId; label: string; description: string }[] = [
  { id: 'steps', label: 'Steps', description: 'Steps today from your phone or your entries' },
  { id: 'activity', label: 'Movement', description: 'Active minutes and energy from logged activity' },
  { id: 'nutrition', label: 'Food', description: 'Calories and macros eaten today' },
  { id: 'water', label: 'Water', description: 'Water logged today' },
  { id: 'habits', label: 'Habits', description: "Today's habit checklist" },
  { id: 'medications', label: 'Medications', description: 'Reminders still to come today' },
  { id: 'workout', label: "Today's workout", description: 'Workouts scheduled for today' },
  { id: 'sleep', label: 'Sleep', description: 'Your most recent night' },
  { id: 'heart', label: 'Heart', description: 'Latest heart rate and resting heart rate' },
  { id: 'goals', label: 'Goals', description: 'Progress on the goals you set' },
  { id: 'weekly', label: 'This week', description: 'Seven-day summary' },
  { id: 'recent', label: 'Recent entries', description: 'The latest things you logged' },
];

export interface Goals {
  steps: number | null;
  activeMinutes: number | null;
  waterMl: number | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  sleepHours: number | null;
  targetWeightKg: number | null;
  workoutsPerWeek: number | null;
}

export interface ReminderConfig {
  enabled: boolean;
  times: string[];
  notificationIds: string[];
}

interface ProfileData {
  onboarded: boolean;
  name: string;
  dateOfBirth: string | null;
  heightCm: number | null;
  units: UnitPrefs;
  language: 'en';
  goals: Goals;
  diet: { preferences: string[]; allergies: string[] };
  features: { cycleTracking: boolean; useMotion: boolean };
  privacy: { lockJournal: boolean; lockRecords: boolean };
  dashboard: { widgets: { id: WidgetId; enabled: boolean }[] };
  hydration: { containers: { label: string; ml: number }[]; reminders: ReminderConfig };
  sleepReminder: ReminderConfig;
  mindReminder: ReminderConfig;
}

interface ProfileActions {
  update: (patch: Partial<ProfileData>) => void;
  setGoals: (patch: Partial<Goals>) => void;
  setUnits: (patch: Partial<UnitPrefs>) => void;
  reset: () => void;
}

export type ProfileState = ProfileData & ProfileActions;

const EMPTY_GOALS: Goals = {
  steps: null,
  activeMinutes: null,
  waterMl: null,
  calories: null,
  proteinG: null,
  carbsG: null,
  fatG: null,
  sleepHours: null,
  targetWeightKg: null,
  workoutsPerWeek: null,
};

const DEFAULTS: ProfileData = {
  onboarded: false,
  name: '',
  dateOfBirth: null,
  heightCm: null,
  units: DEFAULT_UNITS,
  language: 'en',
  goals: EMPTY_GOALS,
  diet: { preferences: [], allergies: [] },
  features: { cycleTracking: false, useMotion: true },
  privacy: { lockJournal: false, lockRecords: false },
  dashboard: {
    widgets: WIDGETS.map((w) => ({
      id: w.id,
      enabled: ['steps', 'activity', 'nutrition', 'water', 'habits', 'medications', 'workout', 'sleep', 'weekly'].includes(w.id),
    })),
  },
  hydration: {
    containers: [
      { label: 'Glass', ml: 250 },
      { label: 'Mug', ml: 350 },
      { label: 'Bottle', ml: 500 },
    ],
    reminders: { enabled: false, times: [], notificationIds: [] },
  },
  sleepReminder: { enabled: false, times: [], notificationIds: [] },
  mindReminder: { enabled: false, times: [], notificationIds: [] },
};

export const useProfile = create<ProfileState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      update: (patch) => set(patch),
      setGoals: (patch) => set((s) => ({ goals: { ...s.goals, ...patch } })),
      setUnits: (patch) => set((s) => ({ units: { ...s.units, ...patch } })),
      reset: () => set({ ...DEFAULTS }),
    }),
    {
      name: 'knivy.profile',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ProfileData>;
        const knownIds = new Set((p.dashboard?.widgets ?? []).map((w) => w.id));
        return {
          ...current,
          ...p,
          units: { ...current.units, ...p.units },
          goals: { ...current.goals, ...p.goals },
          diet: { ...current.diet, ...p.diet },
          features: { ...current.features, ...p.features },
          privacy: { ...current.privacy, ...p.privacy },
          hydration: { ...current.hydration, ...p.hydration },
          sleepReminder: { ...current.sleepReminder, ...p.sleepReminder },
          mindReminder: { ...current.mindReminder, ...p.mindReminder },
          dashboard: {
            widgets: [
              ...(p.dashboard?.widgets ?? []),
              ...current.dashboard.widgets.filter((w) => !knownIds.has(w.id)),
            ],
          },
        };
      },
    },
  ),
);

export function useProfileHydrated() {
  const [hydrated, setHydrated] = useState(useProfile.persist.hasHydrated());
  useEffect(() => {
    const unsub = useProfile.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(useProfile.persist.hasHydrated());
    return unsub;
  }, []);
  return hydrated;
}
