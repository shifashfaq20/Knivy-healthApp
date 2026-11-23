import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { ageFromDob, dateKey } from './date';
import { parseNumber } from './units';

/** A check returns an error message, or null when the value is fine. */
export type Check = (value: string) => string | null;
export type FieldErrors<K extends string = string> = Partial<Record<K, string>>;
type Maybe = string | null | undefined | false;

/** Shared limits so every screen (and the guide) agrees. */
export const LIMITS = {
  name: 40,
  short: 60,
  title: 80,
  note: 500,
  journal: 20000,
  message: 2000,
  minAge: 13,
  maxAge: 120,
};

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

export interface NumberRule {
  label?: string;
  min?: number;
  max?: number;
  integer?: boolean;
  unit?: string;
  required?: boolean;
  /** Reject 0 even when no minimum is set. */
  positive?: boolean;
}

export function numberError(raw: string, r: NumberRule): string | null {
  const s = raw.trim();
  if (!s) return r.required ? `Enter ${r.label ?? 'a value'}.` : null;
  const n = parseNumber(s);
  if (n === null) return 'Enter a number, such as 72 or 72.5.';
  if (r.integer && !Number.isInteger(n)) return 'Use a whole number.';
  if (r.positive && n <= 0) return 'Must be more than 0.';
  const u = r.unit ? ` ${r.unit}` : '';
  if (r.min !== undefined && r.max !== undefined && (n < r.min || n > r.max)) return `Enter between ${fmt(r.min)} and ${fmt(r.max)}${u}.`;
  if (r.min !== undefined && n < r.min) return `Must be at least ${fmt(r.min)}${u}.`;
  if (r.max !== undefined && n > r.max) return `Must be ${fmt(r.max)}${u} or less.`;
  return null;
}

export const check = {
  required: (label: string): Check => (v) => (v.trim() ? null : `Enter ${label}.`),
  maxLength: (max: number): Check => (v) => (v.trim().length > max ? `Keep this to ${max} characters or fewer.` : null),
  minLength: (min: number, message: string): Check => (v) => (v.trim() && v.trim().length < min ? message : null),
  /** Names: letters in any alphabet, spaces, hyphens, apostrophes (straight or curly) and full stops. */
  personName: (): Check => (v) => {
    const s = v.trim();
    if (!s) return null;
    if (/[0-9]/.test(s)) return 'Names can’t contain numbers.';
    // ASCII symbols, symbol and emoji blocks. Curly apostrophes and dashes (U+2000–U+20FF) stay allowed.
    if (/[_@#$%^&*()+=[\]{}<>\/\\|~`!?;:",\u2100-\u2BFF\uD800-\uDFFF]/.test(s)) return 'Use letters only. Spaces, hyphens and apostrophes are fine.';
    return null;
  },
  number: (rule: NumberRule): Check => (v) => numberError(v, rule),
  /** Rejects entries made only of spaces or symbols, such as "..." or "!!". */
  text: (): Check => (v) => (v.trim() && !/[A-Za-z0-9À-￿]/.test(v) ? 'Use letters or numbers, not only symbols.' : null),
  email: (): Check => (v) => (!v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? null : 'Enter a valid email, like name@example.com.'),
  phone: (): Check => (v) => {
    const s = v.trim();
    if (!s) return null;
    const digits = s.replace(/\D/g, '').length;
    return /^\+?[\d\s()\-.]+$/.test(s) && digits >= 6 && digits <= 15 ? null : 'Enter a phone number using digits, spaces, + or -.';
  },
};

/** Runs each field's checks in order and keeps the first message per field. */
export function validate<K extends string>(values: Record<K, string>, schema: Partial<Record<K, Check[]>>): FieldErrors<K> {
  const out: FieldErrors<K> = {};
  for (const key of Object.keys(schema) as K[]) {
    for (const c of schema[key] ?? []) {
      const msg = c(values[key] ?? '');
      if (msg) {
        out[key] = msg;
        break;
      }
    }
  }
  return out;
}

export function futureError(d: Date | null | undefined, what = 'This'): string | null {
  return d && d.getTime() > Date.now() + 60_000 ? `${what} can’t be in the future.` : null;
}

export function dobError(dob: Date | null): string | null {
  if (!dob) return null;
  if (dob.getTime() > Date.now()) return 'Date of birth can’t be in the future.';
  const age = ageFromDob(dateKey(dob)) ?? 0;
  if (age < LIMITS.minAge) return `Knivy is for people aged ${LIMITS.minAge} and over.`;
  if (age > LIMITS.maxAge) return 'Check the year of birth.';
  return null;
}

/** EAN-8, UPC-A, EAN-13 and GTIN-14 barcodes, including the check digit. */
export function gtinError(code: string): string | null {
  const s = code.replace(/\s/g, '');
  if (!s) return 'Enter the numbers under the barcode.';
  if (!/^\d+$/.test(s)) return 'Barcodes contain digits only.';
  if (![8, 12, 13, 14].includes(s.length)) return 'Barcodes have 8, 12, 13 or 14 digits.';
  const digits = s.split('').map(Number);
  const checkDigit = digits.pop()!;
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === checkDigit ? null : 'That number doesn’t pass the barcode check. Check each digit.';
}

/** Per-field error state for a form. apply() returns true when there are no errors. */
export function useFormErrors<K extends string>() {
  const [errors, setErrors] = useState<FieldErrors<K>>({});
  const apply = useCallback((next: Partial<Record<K, Maybe>>) => {
    const clean: FieldErrors<K> = {};
    for (const k of Object.keys(next) as K[]) {
      const m = next[k];
      if (m) clean[k] = m;
    }
    setErrors(clean);
    const ok = Object.keys(clean).length === 0;
    if (!ok) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    return ok;
  }, []);
  const clear = useCallback(
    (key: K) =>
      setErrors((e) => {
        if (!e[key]) return e;
        const n = { ...e };
        delete n[key];
        return n;
      }),
    [],
  );
  const set = useCallback((key: K, message: string) => setErrors((e) => ({ ...e, [key]: message })), []);
  return { errors, apply, clear, set, count: Object.keys(errors).length };
}
