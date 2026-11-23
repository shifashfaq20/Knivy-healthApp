import { useMemo } from 'react';
import { useRecords } from '../../hooks/useRecords';
import { repos } from '../../repositories';
import type { Exercise } from '../../types/models';
import { EXERCISES } from './library';

/** Built-in library plus the user's custom exercises. */
export function useExercises() {
  const custom = useRecords(repos.customExercises, { limit: 500 });
  return useMemo<Exercise[]>(
    () => [...(custom.data ?? []).map((r) => ({ ...r.data, id: `custom:${r.id}`, custom: true })), ...EXERCISES],
    [custom.data],
  );
}

export function describeTarget(item: { measure: Exercise['measure']; sets: number; reps?: number | null; durationSec?: number | null; weightKg?: number | null }) {
  if (item.measure === 'time' || item.measure === 'distance') {
    const s = item.durationSec ?? 0;
    const t = s >= 60 ? `${Math.round(s / 60)} min` : `${s} s`;
    return item.sets > 1 ? `${item.sets} × ${t}` : t;
  }
  return `${item.sets} × ${item.reps ?? '?'}`;
}
