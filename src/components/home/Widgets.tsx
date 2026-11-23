import { router } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { BarChart } from '../charts/Charts';
import { Button, Card, EmptyState, Icon, ProgressBar, Ring, SourceBadge, Txt, type IconName } from '../ui';
import { MEASUREMENTS, formatMeasurement } from '../../features/health/definitions';
import { useRecords } from '../../hooks/useRecords';
import { useDaySteps, useMotionStatus, useStepSeries } from '../../hooks/useSteps';
import { repos } from '../../repositories';
import { useProfile } from '../../stores/profileStore';
import { colors } from '../../theme/tokens';
import type { Medication, Rec } from '../../types/models';
import { showError } from '../../utils/alerts';
import {
  WEEKDAYS_LETTER,
  dayRange,
  formatDuration,
  formatHHMM,
  formatTime,
  isoToKey,
  keysRange,
  lastNDays,
  parseHHMM,
  relativeDay,
  todayKey,
  weekdayOf,
} from '../../utils/date';
import { sumPortions } from '../../utils/nutrition';
import { num, volume, weight } from '../../utils/units';

function WidgetTitle({ icon, title, right }: { icon: IconName; title: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <Icon name={icon} size={16} color={colors.muted} />
      <Txt variant="label" tone="muted" style={{ flex: 1 }}>
        {title}
      </Txt>
      {right}
    </View>
  );
}

// ---------- Steps ----------
export function StepsWidget() {
  const today = todayKey();
  const { steps, source } = useDaySteps(today);
  const goal = useProfile((s) => s.goals.steps);
  const motion = useMotionStatus();
  const needsPermission = Platform.OS === 'ios' && motion.data?.available && !motion.data.granted;

  return (
    <Card hero onPress={() => router.push('/(tabs)/activity')} accessibilityLabel="Steps today">
      <WidgetTitle icon="footsteps-outline" title="Steps today" right={source ? <SourceBadge source={source} /> : null} />
      {steps === null ? (
        <EmptyState
          compact
          icon="footsteps-outline"
          title="No steps yet"
          body={
            needsPermission
              ? 'Allow Knivy to read steps from your iPhone’s motion sensor.'
              : Platform.OS === 'android'
                ? 'Android shares step history through Health Connect, which needs a development build. You can add steps yourself.'
                : 'Add steps from a pedometer or another app.'
          }
          actionLabel={needsPermission ? 'Set up steps' : 'Add steps'}
          onAction={() => (needsPermission ? router.push('/devices') : router.push({ pathname: '/health/add', params: { type: 'steps' } }))}
        />
      ) : (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Txt variant="numberLarge">{steps.toLocaleString()}</Txt>
            <Txt tone="muted">{goal ? `of ${goal.toLocaleString()}` : 'steps'}</Txt>
          </View>
          {goal ? <ProgressBar value={steps} max={goal} /> : <Txt variant="caption" tone="muted">Set a step goal in Profile to track progress.</Txt>}
        </View>
      )}
    </Card>
  );
}

// ---------- Movement ----------
export function ActivityWidget() {
  const range = dayRange(todayKey());
  const activities = useRecords(repos.activities, range);
  const sessions = useRecords(repos.workoutSessions, range);
  const goal = useProfile((s) => s.goals.activeMinutes);
  const minutes =
    (activities.data ?? []).reduce((s, a) => s + a.data.durationMin, 0) + (sessions.data ?? []).reduce((s, w) => s + w.data.durationMin, 0);
  const energy = (activities.data ?? []).filter((a) => typeof a.data.energyKcal === 'number');
  const kcal = energy.reduce((s, a) => s + (a.data.energyKcal ?? 0), 0);
  const anyEstimated = energy.some((a) => a.data.energySource === 'estimated');
  const empty = (activities.data?.length ?? 0) + (sessions.data?.length ?? 0) === 0;

  return (
    <Card onPress={() => router.push('/(tabs)/activity')}>
      <WidgetTitle icon="flame-outline" title="Movement today" />
      {empty ? (
        <EmptyState compact icon="walk-outline" title="Nothing logged yet" body="Record a walk with GPS, log an activity or finish a workout." actionLabel="Log activity" onAction={() => router.push('/activity/log')} />
      ) : (
        <View style={{ flexDirection: 'row', gap: 24, alignItems: 'center' }}>
          <Ring value={minutes} max={goal} size={72}>
            <Txt variant="heading">{Math.round(minutes)}</Txt>
          </Ring>
          <View style={{ flex: 1, gap: 6 }}>
            <Txt variant="bodyMedium">{goal ? `${Math.round(minutes)} of ${goal} active minutes` : `${Math.round(minutes)} active minutes`}</Txt>
            <Txt variant="caption" tone="muted">From your logged activities and workouts.</Txt>
            {energy.length ? (
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Txt variant="label">{Math.round(kcal)} kcal</Txt>
                {anyEstimated ? <SourceBadge source="estimated" /> : null}
              </View>
            ) : null}
          </View>
        </View>
      )}
    </Card>
  );
}

// ---------- Heart ----------
export function HeartWidget() {
  const units = useProfile((s) => s.units);
  const recent = useRecords(repos.measurements, { limit: 200 });
  const hr = recent.data?.find((m) => m.data.type === 'heart_rate');
  const rhr = recent.data?.find((m) => m.data.type === 'resting_heart_rate');
  return (
    <Card onPress={() => router.push('/health')}>
      <WidgetTitle icon="heart-outline" title="Heart" />
      {!hr && !rhr ? (
        <EmptyState compact icon="heart-outline" title="No heart readings" body="Add a reading or connect a device that measures heart rate." actionLabel="Add reading" onAction={() => router.push({ pathname: '/health/add', params: { type: 'heart_rate' } })} />
      ) : (
        <View style={{ flexDirection: 'row', gap: 24 }}>
          {[hr, rhr].map((m, i) =>
            m ? (
              <View key={i} style={{ gap: 4, flex: 1 }}>
                <Txt variant="number">{formatMeasurement(m.data.type, m.data.value, m.data.value2, units)}</Txt>
                <Txt variant="caption" tone="muted">
                  {MEASUREMENTS[m.data.type].label}, {relativeDay(isoToKey(m.recordedAt)).toLowerCase()} {formatTime(m.recordedAt)}
                </Txt>
                <SourceBadge source={m.source} name={m.sourceName} />
              </View>
            ) : null,
          )}
        </View>
      )}
    </Card>
  );
}

// ---------- Sleep ----------
export function SleepWidget() {
  const last = useRecords(repos.sleep, { limit: 1 });
  const goal = useProfile((s) => s.goals.sleepHours);
  const s = last.data?.[0];
  const hours = s ? (new Date(s.data.end).getTime() - new Date(s.data.start).getTime()) / 3_600_000 : 0;
  return (
    <Card onPress={() => router.push('/sleep')}>
      <WidgetTitle icon="moon-outline" title="Sleep" right={s ? <SourceBadge source={s.source} /> : null} />
      {!s ? (
        <EmptyState compact icon="moon-outline" title="No sleep recorded" body="Log last night’s sleep to start seeing patterns." actionLabel="Log sleep" onAction={() => router.push('/sleep/log')} />
      ) : (
        <View style={{ gap: 6 }}>
          <Txt variant="number">{formatDuration(hours * 60)}</Txt>
          <Txt variant="caption" tone="muted">
            {relativeDay(isoToKey(s.data.end))}: {formatTime(s.data.start)} to {formatTime(s.data.end)}
            {goal ? `, goal ${goal} h` : ''}
          </Txt>
        </View>
      )}
    </Card>
  );
}

// ---------- Nutrition ----------
export function NutritionWidget() {
  const entries = useRecords(repos.foodEntries, dayRange(todayKey()));
  const goals = useProfile((s) => s.goals);
  const totals = useMemo(() => sumPortions((entries.data ?? []).map((e) => e.data)), [entries.data]);
  const kcal = totals.values.energyKcal;
  const macro = (label: string, key: 'proteinG' | 'carbsG' | 'fatG', goal: number | null) => (
    <View style={{ flex: 1, gap: 6 }}>
      <Txt variant="caption" tone="muted">
        {label}
      </Txt>
      <Txt variant="label">
        {Math.round(totals.values[key])}
        {goal ? ` / ${goal}` : ''} g
      </Txt>
      <ProgressBar value={totals.values[key]} max={goal ?? totals.values[key]} height={5} color={colors.ink} />
    </View>
  );
  return (
    <Card onPress={() => router.push('/(tabs)/nutrition')}>
      <WidgetTitle icon="restaurant-outline" title="Food today" />
      {totals.count === 0 ? (
        <EmptyState compact icon="restaurant-outline" title="No meals logged" body="Search a food database, scan a barcode or use your saved foods." actionLabel="Log food" onAction={() => router.push({ pathname: '/nutrition/search', params: { slot: 'snack' } })} />
      ) : (
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Txt variant="numberLarge">{Math.round(kcal).toLocaleString()}</Txt>
            <Txt tone="muted">{goals.calories ? `of ${goals.calories.toLocaleString()} kcal` : 'kcal'}</Txt>
          </View>
          {totals.missing.energyKcal > 0 ? (
            <Txt variant="caption" tone="muted">
              {totals.missing.energyKcal} item{totals.missing.energyKcal > 1 ? 's have' : ' has'} no energy value, so this total is incomplete.
            </Txt>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 14 }}>
            {macro('Protein', 'proteinG', goals.proteinG)}
            {macro('Carbs', 'carbsG', goals.carbsG)}
            {macro('Fat', 'fatG', goals.fatG)}
          </View>
        </View>
      )}
    </Card>
  );
}

// ---------- Water ----------
export function WaterWidget() {
  const entries = useRecords(repos.water, dayRange(todayKey()));
  const units = useProfile((s) => s.units);
  const goal = useProfile((s) => s.goals.waterMl);
  const containers = useProfile((s) => s.hydration.containers);
  const total = (entries.data ?? []).reduce((s, e) => s + e.data.amountMl, 0);
  const add = async (ml: number, label: string) => {
    try {
      await repos.water.create({ amountMl: ml, container: label });
    } catch (e) {
      showError(e);
    }
  };
  return (
    <Card tone="water" onPress={() => router.push('/hydration')}>
      <WidgetTitle icon="water-outline" title="Water today" />
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Txt variant="number">{volume.format(total, units)}</Txt>
          <Txt tone="muted">{goal ? `of ${volume.format(goal, units)}` : ''}</Txt>
        </View>
        {goal ? <ProgressBar value={total} max={goal} color={colors.water} /> : null}
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {containers.slice(0, 3).map((c) => (
            <Button key={c.label} size="sm" variant="secondary" icon="add" label={`${c.label} ${volume.format(c.ml, units)}`} onPress={() => void add(c.ml, c.label)} />
          ))}
        </View>
      </View>
    </Card>
  );
}

// ---------- Medications ----------
export function MedicationsWidget() {
  const today = todayKey();
  const meds = useRecords(repos.medications);
  const logs = useRecords(repos.medicationLogs, dayRange(today));
  const doses = useMemo(() => {
    const out: { med: Rec<Medication>; time: string; taken: boolean }[] = [];
    for (const m of meds.data ?? []) {
      if (!m.data.active) continue;
      if (m.data.endDate && m.data.endDate < today) continue;
      for (const t of m.data.reminderTimes) {
        const taken = (logs.data ?? []).some((l) => l.data.medicationId === m.id && l.data.scheduledTime === t);
        out.push({ med: m, time: t, taken });
      }
    }
    return out.sort((a, b) => a.time.localeCompare(b.time));
  }, [meds.data, logs.data, today]);

  if ((meds.data ?? []).length === 0) {
    return (
      <Card>
        <WidgetTitle icon="medkit-outline" title="Medications" />
        <EmptyState compact icon="medkit-outline" title="No medications added" body="Add the medicines you take, with the dose your clinician gave you, and set reminders." actionLabel="Add medication" onAction={() => router.push('/records/medication')} />
      </Card>
    );
  }
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return (
    <Card onPress={() => router.push('/records/medications')}>
      <WidgetTitle icon="medkit-outline" title="Medications today" />
      {doses.length === 0 ? (
        <Txt tone="muted">No reminders scheduled for today.</Txt>
      ) : (
        <View style={{ gap: 10 }}>
          {doses.map((d) => {
            const { hour, minute } = parseHHMM(d.time);
            const past = hour * 60 + minute < nowMin;
            return (
              <View key={`${d.med.id}-${d.time}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Txt variant="label" tone={d.taken ? 'faint' : past ? 'danger' : 'muted'} style={{ width: 70 }}>
                  {formatHHMM(d.time)}
                </Txt>
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyMedium" tone={d.taken ? 'faint' : 'ink'}>
                    {d.med.data.name}
                  </Txt>
                  {d.med.data.dosage ? (
                    <Txt variant="caption" tone="muted">
                      {d.med.data.dosage}
                    </Txt>
                  ) : null}
                </View>
                {d.taken ? (
                  <Txt variant="label" tone="moss">
                    Taken
                  </Txt>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    label="Mark taken"
                    onPress={() => void repos.medicationLogs.create({ medicationId: d.med.id, scheduledTime: d.time, date: today }).catch(showError)}
                  />
                )}
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

// ---------- Today's workout ----------
export function WorkoutWidget() {
  const today = todayKey();
  const templates = useRecords(repos.workoutTemplates);
  const sessions = useRecords(repos.workoutSessions, dayRange(today));
  const scheduled = (templates.data ?? []).filter((t) => t.data.weekdays.includes(weekdayOf(today)));
  return (
    <Card onPress={() => router.push('/workouts')}>
      <WidgetTitle icon="barbell-outline" title="Today’s workout" />
      {scheduled.length === 0 ? (
        <EmptyState compact icon="barbell-outline" title="Nothing scheduled today" body="Build a workout and choose the days you want to do it." actionLabel="Plan a workout" onAction={() => router.push('/workouts/builder')} />
      ) : (
        <View style={{ gap: 10 }}>
          {scheduled.map((t) => {
            const done = (sessions.data ?? []).some((s) => s.data.templateId === t.id);
            return (
              <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyMedium">{t.data.name}</Txt>
                  <Txt variant="caption" tone="muted">
                    {t.data.items.length} exercise{t.data.items.length === 1 ? '' : 's'}
                  </Txt>
                </View>
                {done ? (
                  <Txt variant="label" tone="moss">
                    Done
                  </Txt>
                ) : (
                  <Button size="sm" label="Start" icon="play" onPress={() => router.push({ pathname: '/workouts/session', params: { templateId: t.id } })} />
                )}
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

// ---------- Habits ----------
export function HabitsWidget() {
  const today = todayKey();
  const habits = useRecords(repos.habits);
  const logs = useRecords(repos.habitLogs, dayRange(today));
  const due = (habits.data ?? []).filter((h) => !h.data.paused && (h.data.weekdays.length === 0 || h.data.weekdays.includes(weekdayOf(today))));
  const doneIds = new Set((logs.data ?? []).map((l) => l.data.habitId));
  const toggle = async (habitId: string) => {
    try {
      const existing = (logs.data ?? []).find((l) => l.data.habitId === habitId);
      if (existing) await repos.habitLogs.remove(existing.id);
      else await repos.habitLogs.create({ habitId, date: today });
    } catch (e) {
      showError(e);
    }
  };
  return (
    <Card>
      <WidgetTitle
        icon="checkmark-circle-outline"
        title="Habits"
        right={
          due.length ? (
            <Txt variant="caption" tone="muted">
              {due.filter((h) => doneIds.has(h.id)).length} of {due.length}
            </Txt>
          ) : null
        }
      />
      {due.length === 0 ? (
        <EmptyState compact icon="checkmark-circle-outline" title={(habits.data ?? []).length ? 'Nothing due today' : 'No habits yet'} body="Small daily routines, tracked by what you actually complete." actionLabel={(habits.data ?? []).length ? 'View habits' : 'Create a habit'} onAction={() => router.push((habits.data ?? []).length ? '/habits' : '/habits/edit')} />
      ) : (
        <View style={{ gap: 4 }}>
          {due.map((h) => {
            const done = doneIds.has(h.id);
            return (
              <Pressable
                key={h.id}
                onPress={() => void toggle(h.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}
              >
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    borderWidth: 1.5,
                    borderColor: done ? colors.moss : colors.stone,
                    backgroundColor: done ? colors.moss : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {done ? <Icon name="checkmark" size={16} color={colors.paper} /> : null}
                </View>
                <Txt tone={done ? 'muted' : 'ink'} style={{ flex: 1, textDecorationLine: done ? 'line-through' : 'none' }}>
                  {h.data.name}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      )}
    </Card>
  );
}

// ---------- Goals ----------
export function GoalsWidget() {
  const goals = useProfile((s) => s.goals);
  const units = useProfile((s) => s.units);
  const today = todayKey();
  const { steps } = useDaySteps(today);
  const water = useRecords(repos.water, dayRange(today));
  const food = useRecords(repos.foodEntries, dayRange(today));
  const week = lastNDays(7);
  const sessions = useRecords(repos.workoutSessions, keysRange(week[0], week[6]));
  const measures = useRecords(repos.measurements, { limit: 200 });
  const latestWeight = measures.data?.find((m) => m.data.type === 'weight');
  const totals = sumPortions((food.data ?? []).map((f) => f.data));

  const rows: { label: string; value: number; max: number; text: string }[] = [];
  if (goals.steps && steps !== null) rows.push({ label: 'Steps', value: steps, max: goals.steps, text: `${steps.toLocaleString()} / ${goals.steps.toLocaleString()}` });
  if (goals.waterMl) {
    const w = (water.data ?? []).reduce((s, e) => s + e.data.amountMl, 0);
    rows.push({ label: 'Water', value: w, max: goals.waterMl, text: `${volume.format(w, units)} / ${volume.format(goals.waterMl, units)}` });
  }
  if (goals.proteinG) rows.push({ label: 'Protein', value: totals.values.proteinG, max: goals.proteinG, text: `${Math.round(totals.values.proteinG)} / ${goals.proteinG} g` });
  if (goals.workoutsPerWeek) {
    const n = sessions.data?.length ?? 0;
    rows.push({ label: 'Workouts this week', value: n, max: goals.workoutsPerWeek, text: `${n} / ${goals.workoutsPerWeek}` });
  }

  return (
    <Card onPress={() => router.push('/profile/goals')}>
      <WidgetTitle icon="flag-outline" title="Goals" />
      {rows.length === 0 && !goals.targetWeightKg ? (
        <EmptyState compact icon="flag-outline" title="No goals set" body="Set the goals that matter to you. Progress is measured from your own records." actionLabel="Set goals" onAction={() => router.push('/profile/goals')} />
      ) : (
        <View style={{ gap: 12 }}>
          {rows.map((r) => (
            <View key={r.label} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Txt variant="label">{r.label}</Txt>
                <Txt variant="caption" tone="muted">
                  {r.text}
                </Txt>
              </View>
              <ProgressBar value={r.value} max={r.max} height={6} />
            </View>
          ))}
          {goals.targetWeightKg ? (
            <Txt variant="caption" tone="muted">
              Target weight {weight.format(goals.targetWeightKg, units)}
              {latestWeight ? `, latest ${weight.format(latestWeight.data.value, units)}` : ', no weight logged yet'}
            </Txt>
          ) : null}
        </View>
      )}
    </Card>
  );
}

// ---------- This week ----------
export function WeeklyWidget() {
  const days = lastNDays(7);
  const range = keysRange(days[0], days[6]);
  const steps = useStepSeries(days);
  const sessions = useRecords(repos.workoutSessions, range);
  const sleep = useRecords(repos.sleep, range);
  const water = useRecords(repos.water, range);
  const sleepNights = sleep.data ?? [];
  const avgSleep = sleepNights.length
    ? sleepNights.reduce((s, n) => s + (new Date(n.data.end).getTime() - new Date(n.data.start).getTime()) / 3_600_000, 0) / sleepNights.length
    : null;
  const waterDays = new Set((water.data ?? []).map((w) => isoToKey(w.recordedAt))).size;
  const units = useProfile((s) => s.units);
  const waterTotal = (water.data ?? []).reduce((s, w) => s + w.data.amountMl, 0);

  return (
    <Card onPress={() => router.push('/(tabs)/insights')}>
      <WidgetTitle icon="calendar-outline" title="Last 7 days" />
      <BarChart height={110} data={steps.map((s) => ({ label: WEEKDAYS_LETTER[weekdayOf(s.key)], value: s.steps }))} />
      <View style={{ flexDirection: 'row', marginTop: 12, gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Txt variant="heading">{sessions.data?.length ?? 0}</Txt>
          <Txt variant="caption" tone="muted">
            workouts
          </Txt>
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="heading">{avgSleep !== null ? `${num(avgSleep)} h` : 'None'}</Txt>
          <Txt variant="caption" tone="muted">
            {avgSleep !== null ? `average sleep, ${sleepNights.length} nights` : 'sleep logged'}
          </Txt>
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="heading">{waterDays ? volume.format(waterTotal / waterDays, units) : 'None'}</Txt>
          <Txt variant="caption" tone="muted">
            {waterDays ? `water a day, ${waterDays} days` : 'water logged'}
          </Txt>
        </View>
      </View>
      <Txt variant="caption" tone="muted" style={{ marginTop: 8 }}>
        Steps chart: dashed marks are days without step data.
      </Txt>
    </Card>
  );
}

// ---------- Recent ----------
export function RecentWidget() {
  const units = useProfile((s) => s.units);
  const opts = { limit: 4 };
  const food = useRecords(repos.foodEntries, opts);
  const water = useRecords(repos.water, opts);
  const acts = useRecords(repos.activities, opts);
  const meas = useRecords(repos.measurements, opts);
  const moods = useRecords(repos.moods, opts);
  const sessions = useRecords(repos.workoutSessions, opts);
  const items = [
    ...(food.data ?? []).map((r) => ({ at: r.recordedAt, icon: 'restaurant-outline' as const, text: r.data.food.name })),
    ...(water.data ?? []).map((r) => ({ at: r.recordedAt, icon: 'water-outline' as const, text: `Water, ${volume.format(r.data.amountMl, units)}` })),
    ...(acts.data ?? []).map((r) => ({ at: r.recordedAt, icon: 'walk-outline' as const, text: r.data.title ?? `Activity, ${formatDuration(r.data.durationMin)}` })),
    ...(meas.data ?? []).map((r) => ({ at: r.recordedAt, icon: MEASUREMENTS[r.data.type].icon, text: `${MEASUREMENTS[r.data.type].label}, ${formatMeasurement(r.data.type, r.data.value, r.data.value2, units)}` })),
    ...(moods.data ?? []).map((r) => ({ at: r.recordedAt, icon: 'happy-outline' as const, text: 'Mood check-in' })),
    ...(sessions.data ?? []).map((r) => ({ at: r.recordedAt, icon: 'barbell-outline' as const, text: r.data.name })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6);
  return (
    <Card>
      <WidgetTitle icon="time-outline" title="Recent entries" />
      {items.length === 0 ? (
        <Txt tone="muted">Things you log will appear here.</Txt>
      ) : (
        <View style={{ gap: 10 }}>
          {items.map((it, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name={it.icon} size={16} color={colors.muted} />
              <Txt style={{ flex: 1 }} numberOfLines={1}>
                {it.text}
              </Txt>
              <Txt variant="caption" tone="muted">
                {relativeDay(isoToKey(it.at))}
              </Txt>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}
