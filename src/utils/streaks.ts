import { addDaysKey, todayKey, weekdayOf } from './date';

/**
 * Streaks count consecutive *scheduled* days that were completed. Unscheduled days are skipped,
 * and today does not break a streak until the day is over.
 */
export function computeStreaks(doneKeys: Set<string>, weekdays: number[], createdKey: string) {
  const scheduled = (k: string) => weekdays.length === 0 || weekdays.includes(weekdayOf(k));
  const today = todayKey();

  let current = 0;
  let k = today;
  if (scheduled(k) && !doneKeys.has(k)) k = addDaysKey(k, -1);
  let guard = 0;
  while (k >= createdKey && guard < 2000) {
    if (scheduled(k)) {
      if (doneKeys.has(k)) current++;
      else break;
    }
    k = addDaysKey(k, -1);
    guard++;
  }

  let best = 0;
  let run = 0;
  const sorted = [...doneKeys].sort();
  if (sorted.length) {
    let d = sorted[0] < createdKey ? sorted[0] : createdKey;
    guard = 0;
    while (d <= today && guard < 4000) {
      if (scheduled(d)) {
        if (doneKeys.has(d)) {
          run++;
          best = Math.max(best, run);
        } else if (d !== today) {
          run = 0;
        }
      }
      d = addDaysKey(d, 1);
      guard++;
    }
  }
  return { current, best: Math.max(best, current) };
}
