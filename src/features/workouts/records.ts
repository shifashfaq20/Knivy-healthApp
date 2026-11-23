import type { Rec, WorkoutSession } from '../../types/models';

export interface PersonalBest {
  exerciseId: string;
  name: string;
  sessions: number;
  heaviest?: { weightKg: number; reps: number | null; at: string };
  mostReps?: { reps: number; at: string };
  longestSec?: { seconds: number; at: string };
  farthestKm?: { km: number; at: string };
}

/** Bests computed only from recorded, completed sets. */
export function computeBests(sessions: Rec<WorkoutSession>[]) {
  const map = new Map<string, PersonalBest>();
  for (const s of sessions) {
    for (const ex of s.data.exercises) {
      const pb = map.get(ex.exerciseId) ?? { exerciseId: ex.exerciseId, name: ex.name, sessions: 0 };
      pb.sessions++;
      for (const set of ex.sets) {
        if (!set.done) continue;
        if (set.weightKg && (!pb.heaviest || set.weightKg > pb.heaviest.weightKg)) pb.heaviest = { weightKg: set.weightKg, reps: set.reps ?? null, at: s.recordedAt };
        if (set.reps && (!pb.mostReps || set.reps > pb.mostReps.reps)) pb.mostReps = { reps: set.reps, at: s.recordedAt };
        if (set.durationSec && (!pb.longestSec || set.durationSec > pb.longestSec.seconds)) pb.longestSec = { seconds: set.durationSec, at: s.recordedAt };
        if (set.distanceKm && (!pb.farthestKm || set.distanceKm > pb.farthestKm.km)) pb.farthestKm = { km: set.distanceKm, at: s.recordedAt };
      }
      map.set(ex.exerciseId, pb);
    }
  }
  return map;
}
