import type { Goals } from '../stores/profileStore';
import { volume, type UnitPrefs } from '../utils/units';
import type { NumberRule } from '../utils/validation';
import { displayRange } from './health/definitions';

/** Plausible ranges for goals, in the user's display units. They catch typos; they aren't recommendations. */
export const GOAL_RULES: Record<keyof Goals, (u: UnitPrefs) => NumberRule> = {
  steps: () => ({ label: 'a step goal', min: 500, max: 100000, integer: true, unit: 'steps' }),
  activeMinutes: () => ({ label: 'active minutes', min: 5, max: 600, integer: true, unit: 'min' }),
  workoutsPerWeek: () => ({ label: 'workouts a week', min: 1, max: 21, integer: true }),
  calories: () => ({ label: 'an energy goal', min: 500, max: 10000, integer: true, unit: 'kcal' }),
  proteinG: () => ({ label: 'a protein goal', min: 1, max: 500, unit: 'g' }),
  carbsG: () => ({ label: 'a carbohydrate goal', min: 1, max: 1000, unit: 'g' }),
  fatG: () => ({ label: 'a fat goal', min: 1, max: 500, unit: 'g' }),
  waterMl: (u) => ({ label: 'a water goal', min: Math.round(volume.toDisplay(250, u)), max: Math.round(volume.toDisplay(10000, u)), unit: volume.unit(u) }),
  sleepHours: () => ({ label: 'a sleep goal', min: 3, max: 14, unit: 'hours' }),
  targetWeightKg: (u) => ({ label: 'a target weight', ...displayRange('weight', u) }),
};
