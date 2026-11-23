import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getMotionStatus, motionHasHistory, readSteps } from '../integrations/health/motion';
import { repos } from '../repositories';
import { useProfile } from '../stores/profileStore';
import { addDays, dayRange, isoToKey, keysRange, parseDateKey, todayKey } from '../utils/date';
import { useRecords } from './useRecords';

export function useMotionStatus() {
  return useQuery({ queryKey: ['motion', 'status'], queryFn: getMotionStatus });
}

export interface DaySteps {
  steps: number | null;
  source: 'device' | 'manual' | null;
}

/** Device steps for one local day (iOS). */
export function useDeviceSteps(key: string) {
  const useMotion = useProfile((s) => s.features.useMotion);
  const status = useMotionStatus();
  const granted = !!status.data?.granted && useMotion && motionHasHistory;
  return useQuery({
    queryKey: ['steps', 'device', key, granted],
    queryFn: async () => {
      if (!granted) return null;
      const start = parseDateKey(key);
      const end = key === todayKey() ? new Date() : addDays(start, 1);
      return readSteps(start, end);
    },
    refetchInterval: key === todayKey() ? 60_000 : false,
  });
}

/** Steps for a day: device steps when available, otherwise the sum of manual step entries. */
export function useDaySteps(key: string): DaySteps & { loading: boolean } {
  const device = useDeviceSteps(key);
  const manual = useRecords(repos.measurements, dayRange(key));
  return useMemo(() => {
    const manualSum = (manual.data ?? []).filter((m) => m.data.type === 'steps').reduce((s, m) => s + m.data.value, 0);
    const hasManual = (manual.data ?? []).some((m) => m.data.type === 'steps');
    if (typeof device.data === 'number') return { steps: device.data, source: 'device', loading: false };
    if (hasManual) return { steps: manualSum, source: 'manual', loading: false };
    return { steps: null, source: null, loading: device.isLoading || manual.isLoading };
  }, [device.data, device.isLoading, manual.data, manual.isLoading]);
}

/** Per-day steps for a list of days. Device data only covers iOS's ~7-day window. */
export function useStepSeries(keys: string[]) {
  const useMotion = useProfile((s) => s.features.useMotion);
  const status = useMotionStatus();
  const granted = !!status.data?.granted && useMotion && motionHasHistory;
  const first = keys[0];
  const last = keys[keys.length - 1];
  const manual = useRecords(repos.measurements, first && last ? keysRange(first, last) : {}, !!first);
  const device = useQuery({
    queryKey: ['steps', 'series', first, last, granted],
    enabled: !!first,
    queryFn: async () => {
      const out: Record<string, number | null> = {};
      if (!granted) return out;
      const oldest = addDays(new Date(), -7);
      for (const k of keys) {
        const start = parseDateKey(k);
        if (addDays(start, 1) < oldest) {
          out[k] = null;
          continue;
        }
        const end = k === todayKey() ? new Date() : addDays(start, 1);
        out[k] = await readSteps(start < oldest ? oldest : start, end);
      }
      return out;
    },
  });
  return useMemo(() => {
    const manualByDay: Record<string, number> = {};
    for (const m of manual.data ?? []) {
      if (m.data.type !== 'steps') continue;
      const k = isoToKey(m.recordedAt);
      manualByDay[k] = (manualByDay[k] ?? 0) + m.data.value;
    }
    return keys.map((k) => {
      const d = device.data?.[k];
      if (typeof d === 'number') return { key: k, steps: d as number | null, source: 'device' as const };
      if (k in manualByDay) return { key: k, steps: manualByDay[k] as number | null, source: 'manual' as const };
      return { key: k, steps: null as number | null, source: null };
    });
  }, [keys, device.data, manual.data]);
}
