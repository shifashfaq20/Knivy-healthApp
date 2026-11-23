import * as Haptics from 'expo-haptics';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Button, Card, Field, Icon, IconButton, LoadingState, Screen, Txt, FieldError } from '../../src/components/ui';
import { computeBests } from '../../src/features/workouts/records';
import { describeTarget } from '../../src/features/workouts/useExercises';
import { repos } from '../../src/repositories';
import { useDraft } from '../../src/stores/draftStore';
import { useProfile } from '../../src/stores/profileStore';
import { emptySet, useWorkoutSession, type ActiveSession, type DraftExercise, type DraftSet } from '../../src/stores/sessionStore';
import { colors } from '../../src/theme/tokens';
import type { Exercise, Rec, SetLog, WorkoutSession, WorkoutTemplate } from '../../src/types/models';
import { showError } from '../../src/utils/alerts';
import { formatClock } from '../../src/utils/date';
import { newId } from '../../src/utils/id';
import { distance, num, parseNumber, weight, type UnitPrefs } from '../../src/utils/units';
import { LIMITS, numberError } from '../../src/utils/validation';

function waitForHydration() {
  return new Promise<void>((resolve) => {
    if (useWorkoutSession.persist.hasHydrated()) return resolve();
    const unsub = useWorkoutSession.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}

function draftFromExercise(e: Exercise): DraftExercise {
  const sets = e.defaults.sets ?? 3;
  return {
    key: newId(),
    exerciseId: e.id,
    name: e.name,
    measure: e.measure,
    restSec: e.defaults.restSec ?? 60,
    timeUnit: (e.defaults.durationSec ?? 0) >= 120 ? 'min' : 'sec',
    target: describeTarget({ measure: e.measure, sets, reps: e.defaults.reps, durationSec: e.defaults.durationSec }),
    sets: Array.from({ length: sets }, emptySet),
  };
}

function fromTemplate(t: Rec<WorkoutTemplate>): ActiveSession {
  return {
    editingId: null,
    templateId: t.id,
    name: t.data.name,
    startedAt: new Date().toISOString(),
    endedAt: null,
    notes: '',
    exercises: t.data.items.map((it) => ({
      key: newId(),
      exerciseId: it.exerciseId,
      name: it.name,
      measure: it.measure,
      restSec: it.restSec,
      timeUnit: (it.durationSec ?? 0) >= 120 ? 'min' : 'sec',
      target: describeTarget(it),
      sets: Array.from({ length: it.sets }, emptySet),
    })),
  };
}

function fromRecord(r: Rec<WorkoutSession>, u: UnitPrefs): ActiveSession {
  return {
    editingId: r.id,
    templateId: r.data.templateId ?? null,
    name: r.data.name,
    startedAt: r.data.startedAt,
    endedAt: r.data.endedAt,
    notes: r.data.notes ?? '',
    exercises: r.data.exercises.map((e) => {
      const unit = e.sets.some((s) => (s.durationSec ?? 0) >= 120) ? 'min' : 'sec';
      return {
        key: newId(),
        exerciseId: e.exerciseId,
        name: e.name,
        measure: e.measure,
        restSec: e.restSec,
        timeUnit: unit,
        sets: e.sets.map((s) => ({
          reps: s.reps ? String(s.reps) : '',
          weight: s.weightKg ? num(weight.toDisplay(s.weightKg, u), 1) : '',
          time: s.durationSec ? String(unit === 'min' ? Math.round(s.durationSec / 60) : s.durationSec) : '',
          distance: s.distanceKm ? num(distance.toDisplay(s.distanceKm, u), 2) : '',
          done: s.done,
        })),
      };
    }),
  };
}

function toSetLog(s: DraftSet, e: DraftExercise, u: UnitPrefs): SetLog {
  const w = parseNumber(s.weight);
  const t = parseNumber(s.time);
  const d = parseNumber(s.distance);
  return {
    reps: parseNumber(s.reps),
    weightKg: w !== null ? weight.fromDisplay(w, u) : null,
    durationSec: t !== null ? (e.timeUnit === 'min' ? t * 60 : t) : null,
    distanceKm: d !== null ? distance.fromDisplay(d, u) : null,
    done: true,
  };
}

export default function WorkoutSessionScreen() {
  const { templateId, sessionId } = useLocalSearchParams<{ templateId?: string; sessionId?: string }>();
  const active = useWorkoutSession((s) => s.active);
  const startSession = useWorkoutSession((s) => s.start);
  const patch = useWorkoutSession((s) => s.patch);
  const clear = useWorkoutSession((s) => s.clear);
  const units = useProfile((s) => s.units);
  const picked = useDraft((s) => s.pickedExercise);
  const setPicked = useDraft((s) => s.setPickedExercise);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [restEnds, setRestEnds] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [setErrors, setSetErrors] = useState<Record<string, string>>({});
  const init = useRef(false);

  useEffect(() => {
    if (init.current) return;
    init.current = true;
    (async () => {
      await waitForHydration();
      if (!useWorkoutSession.getState().active) {
        if (sessionId) {
          const rec = await repos.workoutSessions.get(sessionId);
          if (rec) startSession(fromRecord(rec, units));
        } else if (templateId) {
          const t = await repos.workoutTemplates.get(templateId);
          startSession(
            t
              ? fromTemplate(t)
              : { editingId: null, templateId: null, name: 'Workout', startedAt: new Date().toISOString(), endedAt: null, notes: '', exercises: [] },
          );
        } else {
          startSession({ editingId: null, templateId: null, name: 'Workout', startedAt: new Date().toISOString(), endedAt: null, notes: '', exercises: [] });
        }
      }
      setReady(true);
    })().catch(showError);
  }, [sessionId, templateId, startSession, units]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (restEnds && now >= restEnds) {
      setRestEnds(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
  }, [now, restEnds]);

  useEffect(() => {
    if (picked?.for === 'session') {
      patch((s) => ({ ...s, exercises: [...s.exercises, draftFromExercise(picked.exercise)] }));
      setPicked(null);
    }
  }, [picked, patch, setPicked]);

  if (!ready || !active) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Workout' }} />
        <LoadingState />
      </Screen>
    );
  }

  const editing = !!active.editingId;
  const elapsed = editing && active.endedAt ? (new Date(active.endedAt).getTime() - new Date(active.startedAt).getTime()) / 1000 : (now - new Date(active.startedAt).getTime()) / 1000;

  const updateSet = (exKey: string, i: number, p: Partial<DraftSet>) => {
    const errKey = `${exKey}:${i}`;
    setSetErrors((m) => (m[errKey] ? Object.fromEntries(Object.entries(m).filter(([k]) => k !== errKey)) : m));
    patch((s) => ({
      ...s,
      exercises: s.exercises.map((e) => (e.key === exKey ? { ...e, sets: e.sets.map((set, j) => (j === i ? { ...set, ...p } : set)) } : e)),
    }));
  };

  /** A set can only be ticked when what you did is filled in and plausible. */
  const setProblem = (e: DraftExercise, s: DraftSet): string | null => {
    const timeRule = { label: 'how long it lasted', required: true, positive: true, max: e.timeUnit === 'min' ? 600 : 36000, unit: e.timeUnit };
    if (e.measure === 'reps' || e.measure === 'reps_weight') {
      const r = numberError(s.reps, { label: 'the reps you did', required: true, min: 1, max: 1000, integer: true });
      if (r) return r;
    }
    if (e.measure === 'reps_weight') return numberError(s.weight, { min: 0, max: Math.round(weight.toDisplay(1000, units)), unit: units.weight });
    if (e.measure === 'time') return numberError(s.time, timeRule);
    if (e.measure === 'distance') {
      return (
        numberError(s.distance, { label: 'the distance', required: true, positive: true, max: Math.round(distance.toDisplay(500, units)), unit: units.distance }) ??
        numberError(s.time, { ...timeRule, required: false })
      );
    }
    return null;
  };

  const toggleDone = (e: DraftExercise, i: number) => {
    const willBeDone = !e.sets[i].done;
    if (willBeDone) {
      const problem = setProblem(e, e.sets[i]);
      if (problem) {
        setSetErrors((m) => ({ ...m, [`${e.key}:${i}`]: problem }));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
        return;
      }
    }
    updateSet(e.key, i, { done: willBeDone });
    if (willBeDone && e.restSec > 0 && !editing) setRestEnds(Date.now() + e.restSec * 1000);
    void Haptics.selectionAsync().catch(() => undefined);
  };

  const discard = () =>
    Alert.alert(editing ? 'Discard changes?' : 'Discard this workout?', editing ? 'The saved workout stays as it was.' : 'Nothing will be saved.', [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          clear();
          router.back();
        },
      },
    ]);

  const finish = async () => {
    const done = active.exercises.map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) })).filter((e) => e.sets.length > 0);
    if (done.length === 0) {
      Alert.alert('No completed sets', 'Tick the sets you finished, or discard this workout.');
      return;
    }
    setSaving(true);
    try {
      const endedAt = active.endedAt ?? new Date().toISOString();
      const session: WorkoutSession = {
        templateId: active.templateId,
        name: active.name.trim() || 'Workout',
        startedAt: active.startedAt,
        endedAt,
        durationMin: Math.max(1, Math.round((new Date(endedAt).getTime() - new Date(active.startedAt).getTime()) / 60000)),
        notes: active.notes.trim() || undefined,
        exercises: done.map((e) => ({ exerciseId: e.exerciseId, name: e.name, measure: e.measure, restSec: e.restSec, sets: e.sets.map((s) => toSetLog(s, e, units)) })),
      };
      const history = (await repos.workoutSessions.list({ limit: 1000 })).filter((r) => r.id !== active.editingId);
      const before = computeBests(history);
      if (active.editingId) await repos.workoutSessions.update(active.editingId, session, session.startedAt);
      else await repos.workoutSessions.create(session, { recordedAt: session.startedAt });

      const news: string[] = [];
      for (const ex of session.exercises) {
        const prev = before.get(ex.exerciseId);
        if (!prev) continue;
        const heaviest = Math.max(0, ...ex.sets.map((s) => s.weightKg ?? 0));
        const reps = Math.max(0, ...ex.sets.map((s) => s.reps ?? 0));
        if (heaviest && prev.heaviest && heaviest > prev.heaviest.weightKg) news.push(`${ex.name}: ${weight.format(heaviest, units)}`);
        else if (reps && prev.mostReps && reps > prev.mostReps.reps && !heaviest) news.push(`${ex.name}: ${reps} reps`);
      }
      clear();
      router.back();
      if (news.length) Alert.alert('New personal best', news.join('\n'));
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      keyboard
      footer={
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button full label="Discard" variant="secondary" onPress={discard} />
          </View>
          <View style={{ flex: 2 }}>
            <Button full label={editing ? 'Save changes' : 'Finish workout'} onPress={finish} loading={saving} />
          </View>
        </View>
      }
    >
      <Stack.Screen options={{ title: editing ? 'Edit workout' : 'Workout', gestureEnabled: false }} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Field value={active.name} onChangeText={(name) => patch((s) => ({ ...s, name }))} placeholder="Workout name" maxLength={LIMITS.short} />
        </View>
        <View style={{ marginLeft: 16, alignItems: 'flex-end' }}>
          <Txt variant="caption" tone="muted">
            {editing ? 'Duration' : 'Elapsed'}
          </Txt>
          <Txt variant="number">{formatClock(elapsed)}</Txt>
        </View>
      </View>

      {restEnds ? (
        <Card tone="moss">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Txt variant="label" tone="muted">
                Rest
              </Txt>
              <Txt variant="number">{formatClock((restEnds - now) / 1000)}</Txt>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button size="sm" variant="secondary" label="+30 s" onPress={() => setRestEnds((r) => (r ? r + 30_000 : r))} />
              <Button size="sm" label="Skip" onPress={() => setRestEnds(null)} />
            </View>
          </View>
        </Card>
      ) : null}

      {active.exercises.map((e) => (
        <Card key={e.key} padding={16}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Txt variant="heading">{e.name}</Txt>
              {e.target ? (
                <Txt variant="caption" tone="muted">
                  Target {e.target}
                </Txt>
              ) : null}
            </View>
            <IconButton
              icon="close"
              tone="clear"
              size={32}
              label={`Remove ${e.name}`}
              onPress={() => patch((s) => ({ ...s, exercises: s.exercises.filter((x) => x.key !== e.key) }))}
            />
          </View>
          <View style={{ gap: 8, marginTop: 10 }}>
            {e.sets.map((set, i) => (
              <View key={i} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Txt variant="label" tone="muted" style={{ width: 18 }}>
                  {i + 1}
                </Txt>
                {e.measure === 'reps' || e.measure === 'reps_weight' ? (
                  <View style={{ flex: 1 }}>
                    <Field value={set.reps} onChangeText={(v) => updateSet(e.key, i, { reps: v })} keyboardType="number-pad" suffix="reps" />
                  </View>
                ) : null}
                {e.measure === 'reps_weight' ? (
                  <View style={{ flex: 1 }}>
                    <Field value={set.weight} onChangeText={(v) => updateSet(e.key, i, { weight: v })} keyboardType="decimal-pad" suffix={units.weight} />
                  </View>
                ) : null}
                {e.measure === 'distance' ? (
                  <View style={{ flex: 1 }}>
                    <Field value={set.distance} onChangeText={(v) => updateSet(e.key, i, { distance: v })} keyboardType="decimal-pad" suffix={units.distance} />
                  </View>
                ) : null}
                {e.measure === 'time' || e.measure === 'distance' ? (
                  <View style={{ flex: 1 }}>
                    <Field value={set.time} onChangeText={(v) => updateSet(e.key, i, { time: v })} keyboardType="number-pad" suffix={e.timeUnit} />
                  </View>
                ) : null}
                <Pressable
                  onPress={() => toggleDone(e, i)}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`Set ${i + 1} done`}
                  accessibilityState={{ checked: set.done }}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: set.done ? colors.moss : colors.linen,
                    borderWidth: 1,
                    borderColor: set.done ? colors.moss : colors.stone,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="checkmark" size={20} color={set.done ? colors.paper : colors.taupe} />
                </Pressable>
              </View>
              <FieldError message={setErrors[`${e.key}:${i}`]} />
              </View>
            ))}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button size="sm" variant="secondary" icon="add" label="Add set" onPress={() => patch((s) => ({ ...s, exercises: s.exercises.map((x) => (x.key === e.key ? { ...x, sets: [...x.sets, emptySet()] } : x)) }))} />
              {e.sets.length > 1 ? (
                <Button size="sm" variant="ghost" label="Remove last set" onPress={() => patch((s) => ({ ...s, exercises: s.exercises.map((x) => (x.key === e.key ? { ...x, sets: x.sets.slice(0, -1) } : x)) }))} />
              ) : null}
            </View>
          </View>
        </Card>
      ))}

      <Button label="Add exercise" icon="add" variant="secondary" onPress={() => router.push({ pathname: '/workouts/library', params: { pick: 'session' } })} />
      <Field label="Notes" value={active.notes} onChangeText={(notes) => patch((s) => ({ ...s, notes }))} multiline placeholder="How did it feel?" maxLength={LIMITS.note} />
      <Txt variant="caption" tone="muted">
        Only sets you tick are saved, and a set can be ticked once what you did is filled in. Your progress is kept if you leave this screen.
      </Txt>
    </Screen>
  );
}
