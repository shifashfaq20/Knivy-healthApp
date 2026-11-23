import type { Datum } from '../../components/charts/Charts';
import { WEEKDAYS_LETTER, formatDate, parseDateKey, weekdayOf } from '../../utils/date';

export type Granularity = 'day' | 'week' | 'month';

export interface Bucket {
  label: string;
  keys: string[];
}

export function chooseGranularity(days: number): Granularity {
  if (days <= 31) return 'day';
  if (days <= 120) return 'week';
  return 'month';
}

export function makeBuckets(keys: string[], g: Granularity): Bucket[] {
  if (g === 'day') {
    return keys.map((k) => ({ label: keys.length <= 7 ? WEEKDAYS_LETTER[weekdayOf(k)] : String(parseDateKey(k).getDate()), keys: [k] }));
  }
  if (g === 'week') {
    const out: Bucket[] = [];
    for (let i = 0; i < keys.length; i += 7) {
      const chunk = keys.slice(i, i + 7);
      out.push({ label: formatDate(chunk[0]), keys: chunk });
    }
    return out;
  }
  const map = new Map<string, string[]>();
  for (const k of keys) {
    const m = k.slice(0, 7);
    if (!map.has(m)) map.set(m, []);
    map.get(m)!.push(k);
  }
  return [...map.entries()].map(([, ks]) => ({ label: parseDateKey(ks[0]).toLocaleDateString(undefined, { month: 'short' }), keys: ks }));
}

/**
 * avg: average of days that have data (gaps stay gaps).
 * sum: total across the bucket, null if no day has data.
 * last: most recent value in the bucket.
 */
export function aggregate(buckets: Bucket[], daily: Record<string, number>, mode: 'avg' | 'sum' | 'last'): Datum[] {
  return buckets.map((b) => {
    const vals = b.keys.filter((k) => k in daily).map((k) => daily[k]);
    if (!vals.length) return { label: b.label, value: null };
    if (mode === 'sum') return { label: b.label, value: vals.reduce((a, c) => a + c, 0) };
    if (mode === 'last') return { label: b.label, value: vals[vals.length - 1] };
    return { label: b.label, value: vals.reduce((a, c) => a + c, 0) / vals.length };
  });
}

export function coverage(keys: string[], daily: Record<string, number>) {
  const withData = keys.filter((k) => k in daily);
  const avg = withData.length ? withData.reduce((s, k) => s + daily[k], 0) / withData.length : null;
  return { days: withData.length, avg };
}
