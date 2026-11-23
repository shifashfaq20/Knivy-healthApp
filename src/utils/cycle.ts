import type { Flow, Period, Rec } from '../types/models';
import { addDaysKey, daysBetweenKeys, todayKey } from './date';

export interface CycleStats {
  cycleLengths: { start: string; length: number }[];
  avgCycle: number | null;
  minCycle: number | null;
  maxCycle: number | null;
  avgPeriod: number | null;
  periodsLogged: number;
}

export interface CyclePrediction {
  nextStart: string;
  nextEnd: string | null;
  ovulationEstimate: string;
  fertileStart: string;
  fertileEnd: string;
  basedOnCycles: number;
  confidence: 'low' | 'moderate';
  daysLate: number;
}

export function sortPeriods(periods: Rec<Period>[]) {
  return [...periods].sort((a, b) => a.data.startDate.localeCompare(b.data.startDate));
}

export function periodLength(p: Period) {
  return p.endDate ? daysBetweenKeys(p.startDate, p.endDate) + 1 : null;
}

export function computeCycleStats(periods: Rec<Period>[]): CycleStats {
  const sorted = sortPeriods(periods);
  const cycleLengths: { start: string; length: number }[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const length = daysBetweenKeys(sorted[i - 1].data.startDate, sorted[i].data.startDate);
    // Gaps over 90 days usually mean a missed log, so they are excluded from averages.
    if (length >= 10 && length <= 90) cycleLengths.push({ start: sorted[i - 1].data.startDate, length });
  }
  const recent = cycleLengths.slice(-6).map((c) => c.length);
  const periodLengths = sorted.map((p) => periodLength(p.data)).filter((n): n is number => n !== null && n > 0 && n <= 15);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  return {
    cycleLengths,
    avgCycle: recent.length ? Math.round(avg(recent)!) : null,
    minCycle: recent.length ? Math.min(...recent) : null,
    maxCycle: recent.length ? Math.max(...recent) : null,
    avgPeriod: periodLengths.length ? Math.round(avg(periodLengths.slice(-6))!) : null,
    periodsLogged: sorted.length,
  };
}

/**
 * Calendar-based estimate from the user's own history. Needs at least one complete cycle.
 * It cannot confirm ovulation and must never be presented as contraception.
 */
export function predictNextCycle(periods: Rec<Period>[], stats: CycleStats): CyclePrediction | null {
  if (!stats.avgCycle || periods.length < 2) return null;
  const sorted = sortPeriods(periods);
  const lastStart = sorted[sorted.length - 1].data.startDate;
  const nextStart = addDaysKey(lastStart, stats.avgCycle);
  const nextEnd = stats.avgPeriod ? addDaysKey(nextStart, stats.avgPeriod - 1) : null;
  const ovulationEstimate = addDaysKey(nextStart, -14);
  const spread = (stats.maxCycle ?? 0) - (stats.minCycle ?? 0);
  const recentCycles = Math.min(stats.cycleLengths.length, 6);
  return {
    nextStart,
    nextEnd,
    ovulationEstimate,
    fertileStart: addDaysKey(ovulationEstimate, -5),
    fertileEnd: addDaysKey(ovulationEstimate, 1),
    basedOnCycles: recentCycles,
    confidence: recentCycles >= 3 && spread <= 7 ? 'moderate' : 'low',
    daysLate: Math.max(0, daysBetweenKeys(nextStart, todayKey())),
  };
}

export interface DayInfo {
  flow: Flow | 'logged' | null;
  inPeriod: boolean;
  predictedPeriod: boolean;
  fertile: boolean;
  cycleDay: number | null;
}

export function dayInfo(key: string, periods: Rec<Period>[], prediction: CyclePrediction | null): DayInfo {
  let inPeriod = false;
  let flow: DayInfo['flow'] = null;
  let cycleDay: number | null = null;
  const today = todayKey();
  for (const p of periods) {
    const start = p.data.startDate;
    const end = p.data.endDate ?? (start <= today ? today : start);
    if (key >= start && key <= end) {
      inPeriod = true;
      flow = p.data.flow[key] ?? 'logged';
    }
    if (start <= key) {
      const d = daysBetweenKeys(start, key) + 1;
      if (cycleDay === null || d < cycleDay) cycleDay = d;
    }
  }
  const predictedPeriod =
    !!prediction &&
    !inPeriod &&
    key >= prediction.nextStart &&
    key <= (prediction.nextEnd ?? prediction.nextStart) &&
    key >= today;
  const fertile = !!prediction && key >= prediction.fertileStart && key <= prediction.fertileEnd && key >= today;
  return { flow, inPeriod, predictedPeriod, fertile, cycleDay };
}

export const CYCLE_SYMPTOMS = [
  'Cramps',
  'Headache',
  'Bloating',
  'Acne',
  'Breast tenderness',
  'Back pain',
  'Fatigue',
  'Nausea',
  'Cravings',
  'Insomnia',
];

export const CYCLE_MOODS = ['Calm', 'Happy', 'Irritable', 'Anxious', 'Sad', 'Sensitive'];
export const MUCUS_TYPES = ['Dry', 'Sticky', 'Creamy', 'Watery', 'Egg white'];
export const FLOWS: { id: Flow; label: string }[] = [
  { id: 'spotting', label: 'Spotting' },
  { id: 'light', label: 'Light' },
  { id: 'medium', label: 'Medium' },
  { id: 'heavy', label: 'Heavy' },
];
