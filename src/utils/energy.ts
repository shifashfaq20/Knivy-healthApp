import type { ActivityKind } from '../types/models';

// Approximate MET values (Compendium of Physical Activities, moderate effort).
// Results are estimates and are always labelled as such in the UI.
const MET: Record<ActivityKind, number | null> = {
  walk: 3.5,
  run: 9.0,
  cycle: 7.0,
  hike: 6.0,
  swim: 6.0,
  other: null,
};

export function estimateEnergyKcal(kind: ActivityKind, durationMin: number, weightKg: number | null | undefined) {
  const met = MET[kind];
  if (!met || !weightKg || durationMin <= 0) return null;
  return Math.round(met * weightKg * (durationMin / 60));
}
