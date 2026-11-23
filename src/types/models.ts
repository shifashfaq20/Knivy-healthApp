// Domain models stored as JSON payloads in local SQLite collections.
// All timestamps are ISO-8601 UTC strings. Calendar dates are local "YYYY-MM-DD" keys.

export type Source = 'manual' | 'device' | 'imported' | 'estimated';
export type SyncStatus = 'pending' | 'synced' | 'error';

export interface RecordMeta {
  id: string;
  recordedAt: string;
  source: Source;
  sourceName: string | null;
  externalId: string | null;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

export type Rec<T> = RecordMeta & { data: T };

// ---------- Health monitoring ----------
export type MeasurementType =
  | 'heart_rate'
  | 'resting_heart_rate'
  | 'blood_pressure'
  | 'spo2'
  | 'temperature'
  | 'weight'
  | 'height'
  | 'steps';

export interface Measurement {
  type: MeasurementType;
  /** Canonical units: bpm, mmHg (systolic), %, °C, kg, cm, steps. */
  value: number;
  /** Diastolic for blood pressure. */
  value2?: number | null;
  note?: string;
}

// ---------- Activity ----------
export type ActivityKind = 'walk' | 'run' | 'cycle' | 'hike' | 'swim' | 'other';

export interface RoutePoint {
  lat: number;
  lng: number;
  t: number;
}

export interface Activity {
  kind: ActivityKind;
  title?: string;
  startedAt: string;
  endedAt: string;
  durationMin: number;
  distanceKm?: number | null;
  energyKcal?: number | null;
  energySource?: 'manual' | 'estimated' | 'device' | null;
  route?: RoutePoint[];
  note?: string;
}

// ---------- Workouts ----------
export type ExerciseCategory =
  | 'strength'
  | 'cardio'
  | 'hiit'
  | 'yoga'
  | 'pilates'
  | 'stretching'
  | 'mobility'
  | 'walking'
  | 'running'
  | 'cycling';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type WorkoutSetting = 'home' | 'gym';
export type ExerciseMeasure = 'reps' | 'reps_weight' | 'time' | 'distance';

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  muscles: string[];
  equipment: string[];
  difficulty: Difficulty;
  settings: WorkoutSetting[];
  instructions: string[];
  measure: ExerciseMeasure;
  defaults: { sets?: number; reps?: number; durationSec?: number; restSec?: number };
  custom?: boolean;
}

export type CustomExercise = Omit<Exercise, 'id' | 'custom'>;

export interface WorkoutTemplateItem {
  exerciseId: string;
  name: string;
  measure: ExerciseMeasure;
  sets: number;
  reps?: number | null;
  weightKg?: number | null;
  durationSec?: number | null;
  restSec: number;
}

export interface WorkoutTemplate {
  name: string;
  items: WorkoutTemplateItem[];
  /** 0 = Sunday … 6 = Saturday */
  weekdays: number[];
  notes?: string;
}

export interface SetLog {
  reps?: number | null;
  weightKg?: number | null;
  durationSec?: number | null;
  distanceKm?: number | null;
  done: boolean;
}

export interface SessionExercise {
  exerciseId: string;
  name: string;
  measure: ExerciseMeasure;
  restSec: number;
  sets: SetLog[];
}

export interface WorkoutSession {
  templateId?: string | null;
  name: string;
  startedAt: string;
  endedAt: string;
  durationMin: number;
  exercises: SessionExercise[];
  notes?: string;
}

// ---------- Nutrition ----------
export interface Nutrients {
  energyKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  sugarG: number | null;
  saturatedFatG: number | null;
  sodiumMg: number | null;
}

export interface Serving {
  label: string;
  grams: number;
}

export type FoodProvider = 'openfoodfacts' | 'usda' | 'custom' | 'recipe';

export interface FoodItem {
  key: string;
  provider: FoodProvider;
  providerId: string;
  name: string;
  brand?: string | null;
  barcode?: string | null;
  /** Nutrients per 100 g (or 100 ml when basis is ml). null = not provided by the source. */
  per100g: Nutrients;
  basis: 'g' | 'ml';
  servings: Serving[];
  /** Allergen tags from the source (e.g. "milk"). null = the source has no allergen data. */
  allergens?: string[] | null;
  /** Ingredient analysis tags from the source (e.g. "vegan", "non-vegetarian"). */
  dietTags?: string[] | null;
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface FoodEntry {
  slot: MealSlot;
  food: FoodItem;
  grams: number;
  servingLabel?: string | null;
  origin?: 'search' | 'barcode' | 'photo' | 'recipe' | 'plan' | 'custom';
}

export interface CustomFood {
  food: FoodItem;
}

export interface RecipeIngredient {
  food: FoodItem;
  grams: number;
}

export interface Recipe {
  name: string;
  servings: number;
  ingredients: RecipeIngredient[];
  instructions?: string;
}

export interface MealPlanItem {
  date: string;
  slot: MealSlot;
  name: string;
  recipeId?: string | null;
  food?: FoodItem | null;
  grams?: number | null;
  servings?: number | null;
}

// ---------- Hydration ----------
export interface WaterEntry {
  amountMl: number;
  container?: string | null;
}

// ---------- Sleep ----------
export type SleepStage = 'awake' | 'light' | 'core' | 'deep' | 'rem';

export interface SleepSession {
  start: string;
  end: string;
  quality?: number | null;
  note?: string;
  /** Present only when a connected device supplies stages. Never generated. */
  stages?: { stage: SleepStage; start: string; end: string }[] | null;
  restingHr?: number | null;
}

// ---------- Cycle ----------
export type Flow = 'spotting' | 'light' | 'medium' | 'heavy';

export interface Period {
  startDate: string;
  endDate?: string | null;
  flow: Record<string, Flow>;
}

export interface CycleDayLog {
  date: string;
  symptoms: string[];
  mood?: string | null;
  energy?: number | null;
  mucus?: string | null;
  bbtC?: number | null;
  note?: string;
}

// ---------- Mind ----------
export interface MoodCheckin {
  mood: number;
  stress?: number | null;
  energy?: number | null;
  tags: string[];
  note?: string;
}

export interface JournalEntry {
  title?: string;
  body: string;
  mood?: number | null;
}

// ---------- Habits ----------
export type HabitCategory = 'exercise' | 'sleep' | 'nutrition' | 'mind' | 'health' | 'other';

export interface Habit {
  name: string;
  category: HabitCategory;
  routine: 'morning' | 'evening' | 'anytime';
  weekdays: number[];
  reminderTime?: string | null;
  notificationIds?: string[];
  paused: boolean;
}

export interface HabitLog {
  habitId: string;
  date: string;
}

// ---------- Personal health records ----------
export interface Medication {
  name: string;
  dosage?: string;
  form?: string;
  frequency?: string;
  instructions?: string;
  prescriber?: string;
  startDate?: string | null;
  endDate?: string | null;
  reminderTimes: string[];
  notificationIds?: string[];
  active: boolean;
}

export interface MedicationLog {
  medicationId: string;
  scheduledTime?: string | null;
  date: string;
}

export interface Allergy {
  allergen: string;
  reaction?: string;
  severity?: string | null;
  note?: string;
}

export interface Condition {
  name: string;
  since?: string | null;
  status?: string | null;
  note?: string;
}

export interface Vaccination {
  name: string;
  date?: string | null;
  dose?: string;
  provider?: string;
  note?: string;
}

export interface Appointment {
  title: string;
  dateTime?: string | null;
  provider?: string;
  location?: string;
  note?: string;
}

export interface CareContact {
  name: string;
  role?: string | null;
  specialty?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export type DocumentCategory = 'lab-report' | 'prescription' | 'imaging' | 'discharge' | 'insurance' | 'other';

export interface HealthDocument {
  title: string;
  category: DocumentCategory;
  fileUri: string;
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  date?: string | null;
  note?: string;
}

// ---------- AI assistant ----------
export interface ChatMessage {
  conversationId: string;
  role: 'user' | 'assistant' | 'notice';
  content: string;
  kind?: 'text' | 'unavailable' | 'emergency' | 'error';
}
