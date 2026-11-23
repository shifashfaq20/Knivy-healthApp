import type { FoodItem, MealSlot, Nutrients, Rec, Recipe } from '../types/models';

export const NUTRIENT_KEYS: (keyof Nutrients)[] = [
  'energyKcal',
  'proteinG',
  'carbsG',
  'fatG',
  'fiberG',
  'sugarG',
  'saturatedFatG',
  'sodiumMg',
];

export const NUTRIENT_META: Record<keyof Nutrients, { label: string; unit: string; digits: number }> = {
  energyKcal: { label: 'Energy', unit: 'kcal', digits: 0 },
  proteinG: { label: 'Protein', unit: 'g', digits: 1 },
  carbsG: { label: 'Carbohydrates', unit: 'g', digits: 1 },
  fatG: { label: 'Fat', unit: 'g', digits: 1 },
  fiberG: { label: 'Fibre', unit: 'g', digits: 1 },
  sugarG: { label: 'Sugars', unit: 'g', digits: 1 },
  saturatedFatG: { label: 'Saturated fat', unit: 'g', digits: 1 },
  sodiumMg: { label: 'Sodium', unit: 'mg', digits: 0 },
};

export const MEAL_SLOTS: { id: MealSlot; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snacks' },
];

export function emptyNutrients(): Nutrients {
  return {
    energyKcal: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
    fiberG: null,
    sugarG: null,
    saturatedFatG: null,
    sodiumMg: null,
  };
}

/** Scales per-100 values to a portion. Missing values stay missing. */
export function scaleNutrients(per100: Nutrients, grams: number): Nutrients {
  const out = emptyNutrients();
  for (const k of NUTRIENT_KEYS) {
    const v = per100[k];
    out[k] = v === null || v === undefined ? null : (v * grams) / 100;
  }
  return out;
}

export interface Totals {
  values: Record<keyof Nutrients, number>;
  /** Number of items that had no value for the nutrient (so the total is incomplete). */
  missing: Record<keyof Nutrients, number>;
  count: number;
}

export function sumPortions(items: { food: FoodItem; grams: number }[]): Totals {
  const values = {} as Record<keyof Nutrients, number>;
  const missing = {} as Record<keyof Nutrients, number>;
  for (const k of NUTRIENT_KEYS) {
    values[k] = 0;
    missing[k] = 0;
  }
  for (const item of items) {
    const scaled = scaleNutrients(item.food.per100g, item.grams);
    for (const k of NUTRIENT_KEYS) {
      const v = scaled[k];
      if (v === null) missing[k]++;
      else values[k] += v;
    }
  }
  return { values, missing, count: items.length };
}

export function formatNutrient(key: keyof Nutrients, value: number | null | undefined) {
  if (value === null || value === undefined) return 'Not available';
  const meta = NUTRIENT_META[key];
  return `${value.toLocaleString(undefined, { maximumFractionDigits: meta.digits })} ${meta.unit}`;
}

/** A recipe becomes a loggable food. A nutrient is only filled when every ingredient provides it. */
export function foodFromRecipe(rec: Rec<Recipe>): FoodItem {
  const r = rec.data;
  const totalGrams = r.ingredients.reduce((s, i) => s + i.grams, 0);
  const totals = sumPortions(r.ingredients);
  const per100 = emptyNutrients();
  if (totalGrams > 0) {
    for (const k of NUTRIENT_KEYS) {
      per100[k] = totals.missing[k] > 0 ? null : (totals.values[k] / totalGrams) * 100;
    }
  }
  const servingGrams = r.servings > 0 ? totalGrams / r.servings : totalGrams;
  return {
    key: `recipe:${rec.id}`,
    provider: 'recipe',
    providerId: rec.id,
    name: r.name,
    brand: null,
    per100g: per100,
    basis: 'g',
    servings: [
      { label: '1 serving', grams: Math.round(servingGrams) },
      { label: 'Whole recipe', grams: Math.round(totalGrams) },
    ],
    allergens: null,
  };
}

export const ALLERGENS: { id: string; label: string }[] = [
  { id: 'milk', label: 'Milk' },
  { id: 'eggs', label: 'Eggs' },
  { id: 'peanuts', label: 'Peanuts' },
  { id: 'nuts', label: 'Tree nuts' },
  { id: 'gluten', label: 'Gluten' },
  { id: 'soybeans', label: 'Soy' },
  { id: 'fish', label: 'Fish' },
  { id: 'crustaceans', label: 'Crustaceans' },
  { id: 'molluscs', label: 'Molluscs' },
  { id: 'sesame-seeds', label: 'Sesame' },
  { id: 'celery', label: 'Celery' },
  { id: 'mustard', label: 'Mustard' },
  { id: 'lupin', label: 'Lupin' },
  { id: 'sulphur-dioxide-and-sulphites', label: 'Sulphites' },
];

export const DIET_PREFERENCES: { id: string; label: string }[] = [
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'halal', label: 'Halal' },
  { id: 'kosher', label: 'Kosher' },
  { id: 'low-sodium', label: 'Lower sodium' },
  { id: 'high-protein', label: 'Higher protein' },
];

export function allergenLabel(id: string) {
  return ALLERGENS.find((a) => a.id === id)?.label ?? id.replace(/-/g, ' ');
}

/** Allergens in the food that match the user's allergy list. */
export function allergyConflicts(food: FoodItem, userAllergies: string[]) {
  if (!food.allergens || userAllergies.length === 0) return [];
  return food.allergens.filter((a) => userAllergies.includes(a));
}

/** True when source data explicitly says the food conflicts with a vegan/vegetarian preference. */
export function conflictsWithDiet(food: FoodItem, preferences: string[]) {
  const tags = food.dietTags ?? [];
  if (preferences.includes('vegan') && tags.includes('non-vegan')) return 'Not vegan';
  if ((preferences.includes('vegetarian') || preferences.includes('vegan')) && tags.includes('non-vegetarian'))
    return 'Not vegetarian';
  return null;
}
