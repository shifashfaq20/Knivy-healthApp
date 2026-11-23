import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { BarChart, LineChart, type Datum } from '../../src/components/charts/Charts';
import { Banner, Button, Card, ChipSelect, DateTimeField, PageHeader, Screen, Txt } from '../../src/components/ui';
import { aggregate, chooseGranularity, coverage, makeBuckets } from '../../src/features/insights/buckets';
import { useRecords } from '../../src/hooks/useRecords';
import { useStepSeries } from '../../src/hooks/useSteps';
import { repos } from '../../src/repositories';
import { useProfile } from '../../src/stores/profileStore';
import { colors } from '../../src/theme/tokens';
import type { FoodEntry } from '../../src/types/models';
import { showError } from '../../src/utils/alerts';
import { shareTextFile, toCsv } from '../../src/utils/csv';
import { computeCycleStats } from '../../src/utils/cycle';
import { addDaysKey, dateKey, formatDate, isoToKey, keysBetween, keysRange, parseDateKey, todayKey, weekdayOf } from '../../src/utils/date';
import { sumPortions } from '../../src/utils/nutrition';
import { num, volume, weight } from '../../src/utils/units';

type Preset = '7' | '30' | '90' | '365' | 'custom';

function MetricCard({
  title,
  summary,
  data,
  kind = 'bar',
  color,
  goal,
  format,
  min,
  max,
}: {
  title: string;
  summary: string;
  data: Datum[];
  kind?: 'bar' | 'line';
  color?: string;
  goal?: number | null;
  format?: (v: number) => string;
  min?: number;
  max?: number;
}) {
  return (
    <Card>
      <Txt variant="heading">{title}</Txt>
      <Txt variant="caption" tone="muted" style={{ marginBottom: 8 }}>
        {summary}
      </Txt>
      {kind === 'bar' ? <BarChart data={data} color={color} goal={goal} format={format} /> : <LineChart data={data} color={color} goal={goal} format={format} min={min} max={max} />}
    </Card>
  );
}

export default function Insights() {
  const units = useProfile((s) => s.units);
  const goals = useProfile((s) => s.goals);
  const cycleOn = useProfile((s) => s.features.cycleTracking);
  const [preset, setPreset] = useState<Preset>('30');
  const [customFrom, setCustomFrom] = useState(() => parseDateKey(addDaysKey(todayKey(), -13)));
  const [customTo, setCustomTo] = useState(() => new Date());

  const today = todayKey();
  const fromKey = preset === 'custom' ? dateKey(customFrom) : addDaysKey(today, -(Number(preset) - 1));
  const toKey = preset === 'custom' ? (dateKey(customTo) > today ? today : dateKey(customTo)) : today;
  const keys = useMemo(() => (fromKey <= toKey ? keysBetween(fromKey, toKey) : []), [fromKey, toKey]);
  const range = keysRange(fromKey, toKey);
  const g = chooseGranularity(keys.length);
  const buckets = useMemo(() => makeBuckets(keys, g), [keys, g]);

  const steps = useStepSeries(keys);
  const activities = useRecords(repos.activities, range);
  const sessions = useRecords(repos.workoutSessions, range);
  const food = useRecords(repos.foodEntries, range);
  const water = useRecords(repos.water, range);
  const sleep = useRecords(repos.sleep, range);
  const measures = useRecords(repos.measurements, range);
  const moods = useRecords(repos.moods, range);
  const habits = useRecords(repos.habits, { limit: 500 });
  const habitLogs = useRecords(repos.habitLogs, range);
  const periods = useRecords(repos.periods, { limit: 500 }, cycleOn);

  const daily = useMemo(() => {
    const add = (m: Record<string, number>, k: string, v: number) => (m[k] = (m[k] ?? 0) + v);
    const stepsD: Record<string, number> = {};
    for (const s of steps) if (s.steps !== null) stepsD[s.key] = s.steps;
    const active: Record<string, number> = {};
    const workouts: Record<string, number> = {};
    for (const a of activities.data ?? []) add(active, isoToKey(a.recordedAt), a.data.durationMin);
    for (const s of sessions.data ?? []) {
      add(active, isoToKey(s.recordedAt), s.data.durationMin);
      add(workouts, isoToKey(s.recordedAt), 1);
    }
    const foodByDay: Record<string, FoodEntry[]> = {};
    for (const f of food.data ?? []) (foodByDay[isoToKey(f.recordedAt)] ??= []).push(f.data);
    const kcal: Record<string, number> = {};
    const protein: Record<string, number> = {};
    const carbs: Record<string, number> = {};
    const fat: Record<string, number> = {};
    for (const [k, items] of Object.entries(foodByDay)) {
      const t = sumPortions(items);
      kcal[k] = t.values.energyKcal;
      protein[k] = t.values.proteinG;
      carbs[k] = t.values.carbsG;
      fat[k] = t.values.fatG;
    }
    const waterD: Record<string, number> = {};
    for (const w of water.data ?? []) add(waterD, isoToKey(w.recordedAt), w.data.amountMl);
    const sleepD: Record<string, number> = {};
    for (const s of sleep.data ?? []) add(sleepD, isoToKey(s.data.end), (new Date(s.data.end).getTime() - new Date(s.data.start).getTime()) / 3_600_000);
    const weightD: Record<string, number> = {};
    for (const m of [...(measures.data ?? [])].reverse()) if (m.data.type === 'weight') weightD[isoToKey(m.recordedAt)] = m.data.value;
    const moodSum: Record<string, number> = {};
    const moodN: Record<string, number> = {};
    for (const m of moods.data ?? []) {
      add(moodSum, isoToKey(m.recordedAt), m.data.mood);
      add(moodN, isoToKey(m.recordedAt), 1);
    }
    const moodD: Record<string, number> = Object.fromEntries(Object.keys(moodSum).map((k) => [k, moodSum[k] / moodN[k]]));

    const habitD: Record<string, number> = {};
    const habitDone: Record<string, number> = {};
    const habitDue: Record<string, number> = {};
    const list = (habits.data ?? []).filter((h) => !h.data.paused);
    if (list.length) {
      const logSet = new Set((habitLogs.data ?? []).map((l) => `${l.data.habitId}|${l.data.date}`));
      for (const k of keys) {
        const due = list.filter((h) => isoToKey(h.createdAt) <= k && (h.data.weekdays.length === 0 || h.data.weekdays.includes(weekdayOf(k))));
        if (!due.length) continue;
        const done = due.filter((h) => logSet.has(`${h.id}|${k}`)).length;
        habitDone[k] = done;
        habitDue[k] = due.length;
        habitD[k] = (done / due.length) * 100;
      }
    }
    return { stepsD, active, workouts, kcal, protein, carbs, fat, waterD, sleepD, weightD, moodD, habitD, habitDone, habitDue };
  }, [steps, activities.data, sessions.data, food.data, water.data, sleep.data, measures.data, moods.data, habits.data, habitLogs.data, keys]);

  const cov = (d: Record<string, number>) => coverage(keys, d);
  const describe = (d: Record<string, number>, fmt: (v: number) => string, what = 'a day') => {
    const c = cov(d);
    return c.days ? `Average ${fmt(c.avg!)} ${what} on ${c.days} of ${keys.length} days with data` : `No data in this period`;
  };
  const totalWorkouts = Object.values(daily.workouts).reduce((a, b) => a + b, 0);
  const cycle = useMemo(() => (cycleOn ? computeCycleStats(periods.data ?? []) : null), [cycleOn, periods.data]);
  const cyclesInRange = cycle?.cycleLengths.filter((c) => c.start >= fromKey && c.start <= toKey) ?? [];

  const exportReport = async () => {
    try {
      const d = daily;
      const rows = keys.map((k) => [
        k,
        d.stepsD[k] ?? '',
        steps.find((s) => s.key === k)?.source ?? '',
        d.active[k] !== undefined ? Math.round(d.active[k]) : '',
        d.workouts[k] ?? '',
        d.kcal[k] !== undefined ? Math.round(d.kcal[k]) : '',
        d.protein[k] !== undefined ? d.protein[k].toFixed(1) : '',
        d.carbs[k] !== undefined ? d.carbs[k].toFixed(1) : '',
        d.fat[k] !== undefined ? d.fat[k].toFixed(1) : '',
        d.waterD[k] ?? '',
        d.sleepD[k] !== undefined ? d.sleepD[k].toFixed(2) : '',
        d.weightD[k] !== undefined ? d.weightD[k].toFixed(1) : '',
        d.moodD[k] !== undefined ? d.moodD[k].toFixed(1) : '',
        d.habitDone[k] ?? '',
        d.habitDue[k] ?? '',
      ]);
      const csv = toCsv(
        ['date', 'steps', 'steps_source', 'active_minutes', 'workouts', 'energy_kcal', 'protein_g', 'carbs_g', 'fat_g', 'water_ml', 'sleep_hours', 'weight_kg', 'mood_avg_1_5', 'habits_done', 'habits_scheduled'],
        rows,
      );
      await shareTextFile(`knivy-report-${fromKey}-to-${toKey}.csv`, csv, 'text/csv');
    } catch (e) {
      showError(e, 'Couldn’t create the report');
    }
  };

  return (
    <Screen tab>
      <PageHeader title="Insights" />
      <ChipSelect
        scroll
        options={[
          { label: '7 days', value: '7' as Preset },
          { label: '30 days', value: '30' as Preset },
          { label: '90 days', value: '90' as Preset },
          { label: '1 year', value: '365' as Preset },
          { label: 'Custom', value: 'custom' as Preset },
        ]}
        value={preset}
        onChange={(v) => v && setPreset(v)}
      />
      {preset === 'custom' ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <DateTimeField label="From" mode="date" value={customFrom} onChange={setCustomFrom} maximumDate={new Date()} />
          </View>
          <View style={{ flex: 1 }}>
            <DateTimeField label="To" mode="date" value={customTo} onChange={setCustomTo} maximumDate={new Date()} />
          </View>
        </View>
      ) : null}
      {keys.length === 0 ? <Banner tone="warn" body="The start date is after the end date." /> : null}
      <Txt variant="caption" tone="muted">
        {formatDate(fromKey, true)} to {formatDate(toKey, true)}, shown {g === 'day' ? 'by day' : g === 'week' ? 'by week' : 'by month'}. Gaps are periods with nothing recorded.
      </Txt>

      <MetricCard
        title="Steps"
        data={aggregate(buckets, daily.stepsD, 'avg')}
        goal={g === 'day' ? goals.steps : null}
        summary={`${describe(daily.stepsD, (v) => Math.round(v).toLocaleString())}. Phone step history covers about 7 days on iPhone; older days use entries you added.`}
      />
      <MetricCard title="Active minutes" data={aggregate(buckets, daily.active, g === 'day' ? 'sum' : 'avg')} summary={describe(daily.active, (v) => `${Math.round(v)} min`)} />
      <MetricCard title="Workouts" data={aggregate(buckets, daily.workouts, 'sum')} color={colors.ink} summary={`${totalWorkouts} workout${totalWorkouts === 1 ? '' : 's'} recorded in this period`} />
      <MetricCard title="Energy eaten" data={aggregate(buckets, daily.kcal, 'avg')} goal={goals.calories} summary={describe(daily.kcal, (v) => `${Math.round(v)} kcal`)} />
      <MetricCard
        title="Macronutrients"
        data={aggregate(buckets, daily.protein, 'avg')}
        color={colors.ink}
        goal={goals.proteinG}
        summary={(() => {
          const c = cov(daily.protein);
          if (!c.days) return 'No food logged in this period';
          const a = (d: Record<string, number>) => num(cov(d).avg ?? 0, 0);
          return `Protein shown. Daily averages on ${c.days} logged days: protein ${a(daily.protein)} g, carbs ${a(daily.carbs)} g, fat ${a(daily.fat)} g`;
        })()}
      />
      <MetricCard title="Water" data={aggregate(buckets, daily.waterD, 'avg')} color={colors.water} goal={goals.waterMl} format={(v) => volume.format(v, units)} summary={describe(daily.waterD, (v) => volume.format(v, units))} />
      <MetricCard title="Sleep" data={aggregate(buckets, daily.sleepD, 'avg')} color={colors.ink} goal={goals.sleepHours} format={(v) => `${num(v)} h`} summary={describe(daily.sleepD, (v) => `${num(v)} h`, 'a night')} />
      <MetricCard
        title="Weight"
        kind="line"
        data={aggregate(buckets, Object.fromEntries(Object.entries(daily.weightD).map(([k, v]) => [k, weight.toDisplay(v, units)])), 'last')}
        format={(v) => num(v)}
        summary={(() => {
          const ks = Object.keys(daily.weightD).sort();
          if (ks.length < 1) return 'No weight recorded in this period';
          const first = daily.weightD[ks[0]];
          const last = daily.weightD[ks[ks.length - 1]];
          return ks.length > 1 ? `${weight.format(first, units)} to ${weight.format(last, units)} across ${ks.length} readings` : `One reading: ${weight.format(last, units)}`;
        })()}
      />
      <MetricCard title="Mood" kind="line" min={1} max={5} color={colors.moss} data={aggregate(buckets, daily.moodD, 'avg')} format={(v) => v.toFixed(0)} summary={describe(daily.moodD, (v) => `${v.toFixed(1)} of 5`)} />
      <MetricCard
        title="Habit consistency"
        data={aggregate(buckets, daily.habitD, 'avg')}
        format={(v) => `${Math.round(v)}%`}
        summary={
          Object.keys(daily.habitD).length
            ? `${Math.round(cov(daily.habitD).avg!)}% of scheduled habits completed. Uses your current habit schedules.`
            : 'No active habits in this period'
        }
      />
      {cycle ? (
        <Card>
          <Txt variant="heading">Cycle</Txt>
          <Txt variant="caption" tone="muted">
            {cyclesInRange.length
              ? `Cycles starting in this period: ${cyclesInRange.map((c) => `${c.length} days (${formatDate(c.start)})`).join(', ')}`
              : 'No complete cycles started in this period'}
          </Txt>
        </Card>
      ) : null}

      <Button full label="Download report (CSV)" icon="download-outline" variant="secondary" onPress={() => void exportReport()} disabled={!keys.length} />
      <Txt variant="caption" tone="muted">
        Every chart is drawn from what you recorded or what your phone measured. Nothing is filled in.
      </Txt>
    </Screen>
  );
}
