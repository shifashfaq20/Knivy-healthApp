import type { HabitCategory } from '../types/models';

export const HABIT_CATEGORIES: { value: HabitCategory; label: string }[] = [
  { value: 'exercise', label: 'Exercise' },
  { value: 'sleep', label: 'Sleep' },
  { value: 'nutrition', label: 'Nutrition' },
  { value: 'mind', label: 'Mind' },
  { value: 'health', label: 'Health' },
  { value: 'other', label: 'Other' },
];

export const ROUTINES = [
  { value: 'morning' as const, label: 'Morning' },
  { value: 'anytime' as const, label: 'Any time' },
  { value: 'evening' as const, label: 'Evening' },
];
