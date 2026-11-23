import { create } from 'zustand';
import type { Exercise, FoodItem, MealSlot } from '../types/models';

/** Short-lived hand-off between screens (avoids squeezing large objects into route params). */
interface DraftState {
  food: FoodItem | null;
  foodSlot: MealSlot | null;
  /** Where the picked food should go: the food log, or a recipe being edited. */
  foodTarget: 'log' | 'recipe' | 'photo';
  pickedIngredient: { food: FoodItem; grams: number } | null;
  /** Exercise chosen in the library for the builder or a live session. */
  pickedExercise: { exercise: Exercise; for: 'builder' | 'session' } | null;
  setFood: (food: FoodItem | null, slot?: MealSlot | null) => void;
  setTarget: (t: DraftState['foodTarget']) => void;
  setPickedIngredient: (v: DraftState['pickedIngredient']) => void;
  setPickedExercise: (v: DraftState['pickedExercise']) => void;
}

export const useDraft = create<DraftState>()((set) => ({
  food: null,
  foodSlot: null,
  foodTarget: 'log',
  pickedIngredient: null,
  pickedExercise: null,
  setFood: (food, slot) => set((s) => ({ food, foodSlot: slot === undefined ? s.foodSlot : slot })),
  setTarget: (foodTarget) => set({ foodTarget }),
  setPickedIngredient: (pickedIngredient) => set({ pickedIngredient }),
  setPickedExercise: (pickedExercise) => set({ pickedExercise }),
}));
