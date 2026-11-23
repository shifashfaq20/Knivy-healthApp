import axios from 'axios';
import type { FoodItem, Nutrients } from '../../types/models';
import { emptyNutrients } from '../../utils/nutrition';

// USDA FoodData Central. Requires a (free) key in EXPO_PUBLIC_FDC_API_KEY.
// In production this call should be proxied through the Knivy backend.
const KEY = process.env.EXPO_PUBLIC_FDC_API_KEY?.trim() ?? '';

export const usdaConfigured = KEY.length > 0;

interface FdcNutrient {
  nutrientId?: number;
  nutrientNumber?: string;
  unitName?: string;
  value?: number;
}

interface FdcFood {
  fdcId: number;
  description: string;
  dataType?: string;
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients?: FdcNutrient[];
}

const IDS: Record<keyof Nutrients, number[]> = {
  energyKcal: [1008, 2048, 2047],
  proteinG: [1003],
  carbsG: [1005],
  fatG: [1004],
  fiberG: [1079],
  sugarG: [2000, 1063],
  saturatedFatG: [1258],
  sodiumMg: [1093],
};

function titleCase(s: string) {
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function mapFdcFood(f: FdcFood): FoodItem {
  const per100g = emptyNutrients();
  const list = f.foodNutrients ?? [];
  (Object.keys(IDS) as (keyof Nutrients)[]).forEach((key) => {
    for (const id of IDS[key]) {
      const hit = list.find(
        (n) => n.nutrientId === id && typeof n.value === 'number' && (key !== 'energyKcal' || n.unitName?.toUpperCase() === 'KCAL'),
      );
      if (hit && typeof hit.value === 'number') {
        per100g[key] = hit.value;
        break;
      }
    }
  });
  const unit = (f.servingSizeUnit ?? '').toLowerCase();
  const basis: 'g' | 'ml' = unit === 'ml' || unit === 'mlt' ? 'ml' : 'g';
  const servings = [{ label: `100 ${basis}`, grams: 100 }];
  if (f.servingSize && f.servingSize > 0 && ['g', 'grm', 'ml', 'mlt'].includes(unit)) {
    servings.unshift({
      label: f.householdServingFullText ? `${f.householdServingFullText} (${Math.round(f.servingSize)} ${basis})` : `1 serving (${Math.round(f.servingSize)} ${basis})`,
      grams: f.servingSize,
    });
  }
  return {
    key: `usda:${f.fdcId}`,
    provider: 'usda',
    providerId: String(f.fdcId),
    name: titleCase(f.description),
    brand: f.brandName || f.brandOwner || null,
    barcode: f.gtinUpc ?? null,
    per100g,
    basis,
    servings,
    allergens: null,
    dietTags: null,
  };
}

export async function searchUsda(query: string): Promise<FoodItem[]> {
  if (!usdaConfigured) return [];
  const { data } = await axios.get<{ foods?: FdcFood[] }>('https://api.nal.usda.gov/fdc/v1/foods/search', {
    timeout: 15000,
    params: { api_key: KEY, query, pageSize: 25, dataType: 'Foundation,SR Legacy,Survey (FNDDS),Branded' },
  });
  return (data.foods ?? []).map(mapFdcFood);
}
