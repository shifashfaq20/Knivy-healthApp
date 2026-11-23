// Calendar logic uses the phone's time zone. Stored timestamps are UTC ISO strings.

export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAYS_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const pad = (n: number) => String(n).padStart(2, '0');

export function dateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey() {
  return dateKey(new Date());
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function isoToKey(iso: string) {
  return dateKey(new Date(iso));
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addDaysKey(key: string, n: number) {
  return dateKey(addDays(parseDateKey(key), n));
}

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** UTC bounds of a local calendar day: [from, to). */
export function dayRange(key: string) {
  const start = parseDateKey(key);
  return { from: start.toISOString(), to: addDays(start, 1).toISOString() };
}

/** UTC bounds covering local days fromKey..toKey inclusive. */
export function keysRange(fromKey: string, toKey: string) {
  return { from: parseDateKey(fromKey).toISOString(), to: addDays(parseDateKey(toKey), 1).toISOString() };
}

export function daysBetweenKeys(a: string, b: string) {
  return Math.round((parseDateKey(b).getTime() - parseDateKey(a).getTime()) / 86_400_000);
}

export function keysBetween(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  let k = fromKey;
  let guard = 0;
  while (k <= toKey && guard < 1200) {
    out.push(k);
    k = addDaysKey(k, 1);
    guard++;
  }
  return out;
}

export function lastNDays(n: number, endKey = todayKey()) {
  return keysBetween(addDaysKey(endKey, -(n - 1)), endKey);
}

export function weekdayOf(key: string) {
  return parseDateKey(key).getDay();
}

export function formatDateLong(input: Date | string) {
  const d = typeof input === 'string' ? (input.length === 10 ? parseDateKey(input) : new Date(input)) : input;
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

export function formatDate(input: Date | string, withYear = false) {
  const d = typeof input === 'string' ? (input.length === 10 ? parseDateKey(input) : new Date(input)) : input;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });
}

export function formatTime(input: Date | string) {
  const d = typeof input === 'string' ? new Date(input) : input;
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatDateTime(input: Date | string) {
  return `${formatDate(input, true)}, ${formatTime(input)}`;
}

export function relativeDay(key: string) {
  const diff = daysBetweenKeys(key, todayKey());
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff === -1) return 'Tomorrow';
  return formatDate(key, parseDateKey(key).getFullYear() !== new Date().getFullYear());
}

export function formatDuration(minutes: number) {
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** "07:30" -> { hour: 7, minute: 30 } */
export function parseHHMM(value: string) {
  const [h, m] = value.split(':').map(Number);
  return { hour: h || 0, minute: m || 0 };
}

export function toHHMM(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function hhmmToDate(value: string, base = new Date()) {
  const { hour, minute } = parseHHMM(value);
  const d = new Date(base);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function formatHHMM(value: string) {
  return formatTime(hhmmToDate(value));
}

export function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'Device time zone';
  }
}

export function ageFromDob(dob: string | null | undefined) {
  if (!dob) return null;
  const birth = parseDateKey(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

export function startOfMonthKey(key: string) {
  const d = parseDateKey(key);
  return dateKey(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function addMonthsKey(key: string, n: number) {
  const d = parseDateKey(key);
  return dateKey(new Date(d.getFullYear(), d.getMonth() + n, 1));
}

export function monthLabel(key: string) {
  return parseDateKey(key).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
