import axios from 'axios';
import type { FoodItem, Nutrients } from '../../types/models';

// Open Food Facts: open database of branded products (ODbL). No key required.
// Their policy asks apps to identify themselves with a User-Agent.
const BASE = 'https://world.openfoodfacts.org';
const CONTACT = process.env.EXPO_PUBLIC_OFF_CONTACT || 'knivy-app';
const FIELDS = [
  'code',
  'product_name',
  'product_name_en',
  'generic_name',
  'brands',
  'nutriments',
  'serving_size',
  'serving_quantity',
  'allergens_tags',
  'ingredients_analysis_tags',
  'quantity',
].join(',');

const http = axios.create({
  baseURL: BASE,
  timeout: 15000,
  headers: { 'User-Agent': `Knivy/0.1 (${CONTACT})` },
});

type OffNutriments = Record<string, number | string | undefined>;

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  brands?: string;
  nutriments?: OffNutriments;
  serving_size?: string;
  serving_quantity?: number | string;
  allergens_tags?: string[];
  ingredients_analysis_tags?: string[];
  quantity?: string;
}

function read(n: OffNutriments, key: string): number | null {
  const v = n[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

const stripLang = (t: string) => t.replace(/^[a-z]{2,3}:/, '');

export function mapOffProduct(p: OffProduct): FoodItem | null {
  const name = (p.product_name || p.product_name_en || p.generic_name || '').trim();
  if (!name || !p.code) return null;
  const n = p.nutriments ?? {};
  const kj = read(n, 'energy_100g');
  const per100g: Nutrients = {
    // energy_100g is kJ in OFF; converting units is not estimating.
    energyKcal: read(n, 'energy-kcal_100g') ?? (kj !== null ? Math.round(kj / 4.184) : null),
    proteinG: read(n, 'proteins_100g'),
    carbsG: read(n, 'carbohydrates_100g'),
    fatG: read(n, 'fat_100g'),
    fiberG: read(n, 'fiber_100g'),
    sugarG: read(n, 'sugars_100g'),
    saturatedFatG: read(n, 'saturated-fat_100g'),
    sodiumMg: read(n, 'sodium_100g') !== null ? read(n, 'sodium_100g')! * 1000 : null,
  };
  const basis = /\d\s?(ml|cl|l)\b/i.test(p.quantity ?? '') ? 'ml' : 'g';
  const unit = basis === 'ml' ? 'ml' : 'g';
  const servingQty = typeof p.serving_quantity === 'string' ? Number(p.serving_quantity) : p.serving_quantity;
  const servings = [{ label: `100 ${unit}`, grams: 100 }];
  if (servingQty && Number.isFinite(servingQty) && servingQty > 0) {
    servings.unshift({ label: p.serving_size?.trim() || `1 serving (${servingQty} ${unit})`, grams: servingQty });
  }
  return {
    key: `openfoodfacts:${p.code}`,
    provider: 'openfoodfacts',
    providerId: p.code,
    name,
    brand: p.brands?.split(',')[0]?.trim() || null,
    barcode: p.code,
    per100g,
    basis,
    servings,
    allergens: Array.isArray(p.allergens_tags) ? p.allergens_tags.map(stripLang) : null,
    dietTags: Array.isArray(p.ingredients_analysis_tags) ? p.ingredients_analysis_tags.map(stripLang) : null,
  };
}

export async function searchOpenFoodFacts(query: string, page = 1): Promise<FoodItem[]> {
  const { data } = await http.get<{ products?: OffProduct[] }>('/cgi/search.pl', {
    params: { search_terms: query, search_simple: 1, action: 'process', json: 1, page_size: 24, page, fields: FIELDS },
  });
  return (data.products ?? []).map(mapOffProduct).filter((f): f is FoodItem => f !== null);
}

export async function lookupOpenFoodFactsBarcode(code: string): Promise<FoodItem | null> {
  const { data } = await http.get<{ status?: number; product?: OffProduct }>(`/api/v2/product/${encodeURIComponent(code)}.json`, {
    params: { fields: FIELDS },
  });
  if (data.status !== 1 || !data.product) return null;
  return mapOffProduct({ ...data.product, code: data.product.code ?? code });
}
