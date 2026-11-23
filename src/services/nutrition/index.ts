import { repos } from '../../repositories';
import type { FoodItem } from '../../types/models';
import { lookupOpenFoodFactsBarcode, searchOpenFoodFacts } from './openFoodFacts';
import { searchUsda, usdaConfigured } from './usda';

export type FoodSource = 'all' | 'openfoodfacts' | 'usda' | 'mine';
export { usdaConfigured };

export async function searchMyFoods(query: string): Promise<FoodItem[]> {
  const q = query.trim().toLowerCase();
  const custom = await repos.customFoods.list({ limit: 500 });
  return custom
    .map((r) => r.data.food)
    .filter((f) => !q || f.name.toLowerCase().includes(q) || (f.brand ?? '').toLowerCase().includes(q));
}

/** Searches real nutrition databases. Throws on network errors so the UI can offer a retry. */
export async function searchFoods(query: string, source: FoodSource): Promise<FoodItem[]> {
  const q = query.trim();
  if (source === 'mine') return searchMyFoods(q);
  if (q.length < 2) return [];
  if (source === 'openfoodfacts') return searchOpenFoodFacts(q);
  if (source === 'usda') return searchUsda(q);
  const [mine, off, usda] = await Promise.all([
    searchMyFoods(q),
    searchOpenFoodFacts(q).catch((e) => {
      if (!usdaConfigured) throw e;
      return [] as FoodItem[];
    }),
    usdaConfigured ? searchUsda(q).catch(() => [] as FoodItem[]) : Promise.resolve([] as FoodItem[]),
  ]);
  return [...mine, ...usda.filter((f) => f.provider === 'usda'), ...off];
}

export async function lookupBarcode(code: string): Promise<FoodItem | null> {
  const mine = (await searchMyFoods('')).find((f) => f.barcode === code);
  if (mine) return mine;
  const off = await lookupOpenFoodFactsBarcode(code);
  if (off) return off;
  if (usdaConfigured) {
    const hits = await searchUsda(code);
    return hits.find((f) => f.barcode && f.barcode.replace(/^0+/, '') === code.replace(/^0+/, '')) ?? null;
  }
  return null;
}

export function providerLabel(provider: FoodItem['provider']) {
  switch (provider) {
    case 'openfoodfacts':
      return 'Open Food Facts';
    case 'usda':
      return 'USDA FoodData Central';
    case 'recipe':
      return 'Your recipe';
    default:
      return 'Your food';
  }
}
