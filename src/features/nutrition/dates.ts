import { parseDateKey, todayKey } from '../../utils/date';

/** Timestamp to store for an entry logged on a given local day. */
export function timestampForDay(key: string) {
  if (key === todayKey()) return new Date().toISOString();
  const d = parseDateKey(key);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}
