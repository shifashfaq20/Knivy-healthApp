// Every local collection shares one table shape (see database.ts).
// Adding a collection = add its name here and bump a migration.
export const COLLECTIONS = [
  'measurements',
  'activities',
  'custom_exercises',
  'workout_templates',
  'workout_sessions',
  'food_entries',
  'custom_foods',
  'recipes',
  'meal_plans',
  'water_entries',
  'sleep_sessions',
  'periods',
  'cycle_logs',
  'moods',
  'journal_entries',
  'habits',
  'habit_logs',
  'medications',
  'medication_logs',
  'allergies',
  'conditions',
  'vaccinations',
  'appointments',
  'contacts',
  'documents',
  'chat_messages',
] as const;

export type CollectionName = (typeof COLLECTIONS)[number];
