import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Field, FieldError, FormErrorSummary, IconButton, Screen, Stepper, Txt, WeekdayPicker } from '../../src/components/ui';
import { useRecord, useRecords } from '../../src/hooks/useRecords';
import { repos } from '../../src/repositories';
import { useDraft } from '../../src/stores/draftStore';
import { useProfile } from '../../src/stores/profileStore';
import type { Exercise, ExerciseMeasure, WorkoutTemplate } from '../../src/types/models';
import { confirmDelete, showError } from '../../src/utils/alerts';
import { newId } from '../../src/utils/id';
import { num, parseNumber, weight } from '../../src/utils/units';
import { LIMITS, check, numberError, useFormErrors, validate } from '../../src/utils/validation';

interface ItemDraft {
  key: string;
  exerciseId: string;
  name: string;
  measure: ExerciseMeasure;
  sets: number;
  reps: string;
  weight: string;
  time: string;
  timeUnit: 'sec' | 'min';
  rest: string;
}
type ItemField = 'reps' | 'weight' | 'time' | 'rest';

function fromExercise(e: Exercise): ItemDraft {
  const d = e.defaults.durationSec ?? 0;
  const unit = d >= 120 ? 'min' : 'sec';
  return {
    key: newId(),
    exerciseId: e.id,
    name: e.name,
    measure: e.measure,
    sets: e.defaults.sets ?? 3,
    reps: e.defaults.reps ? String(e.defaults.reps) : '',
    weight: '',
    time: d ? String(unit === 'min' ? Math.round(d / 60) : d) : '',
    timeUnit: unit,
    rest: String(e.defaults.restSec ?? 60),
  };
}

export default function WorkoutBuilder() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useRecord(repos.workoutTemplates, id);
  const all = useRecords(repos.workoutTemplates);
  const units = useProfile((s) => s.units);
  const picked = useDraft((s) => s.pickedExercise);
  const setPicked = useDraft((s) => s.setPickedExercise);
  const form = useFormErrors<string>();

  const [name, setName] = useState('');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const t = existing.data?.data;
    if (!t) return;
    setName(t.name);
    setWeekdays(t.weekdays);
    setNotes(t.notes ?? '');
    setItems(
      t.items.map((it) => {
        const unit = (it.durationSec ?? 0) >= 120 ? 'min' : 'sec';
        return {
          key: newId(),
          exerciseId: it.exerciseId,
          name: it.name,
          measure: it.measure,
          sets: it.sets,
          reps: it.reps ? String(it.reps) : '',
          weight: it.weightKg ? num(weight.toDisplay(it.weightKg, units), 1) : '',
          time: it.durationSec ? String(unit === 'min' ? Math.round(it.durationSec / 60) : it.durationSec) : '',
          timeUnit: unit,
          rest: String(it.restSec),
        };
      }),
    );
  }, [existing.data, units]);

  useEffect(() => {
    if (picked?.for === 'builder') {
      setItems((xs) => [...xs, fromExercise(picked.exercise)]);
      form.clear('items');
      setPicked(null);
    }
  }, [picked, setPicked, form.clear]);

  const patch = (key: string, p: Partial<ItemDraft>) => {
    for (const f of Object.keys(p)) form.clear(`${key}:${f}`);
    setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...p } : x)));
  };
  const move = (i: number, dir: -1 | 1) =>
    setItems((xs) => {
      const j = i + dir;
      if (j < 0 || j >= xs.length) return xs;
      const next = [...xs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const err = (key: string, f: ItemField) => form.errors[`${key}:${f}`];

  const save = async () => {
    const errors: Record<string, string | null | undefined> = {
      ...validate({ name, notes }, { name: [check.required('a name for the workout'), check.text(), check.maxLength(LIMITS.short)], notes: [check.maxLength(LIMITS.note)] }),
      items: items.length === 0 ? 'Add at least one exercise.' : null,
    };
    if (!errors.name && (all.data ?? []).some((t) => t.id !== id && t.data.name.trim().toLowerCase() === name.trim().toLowerCase())) {
      errors.name = 'You already have a workout with this name.';
    }
    const maxWeight = Math.round(weight.toDisplay(1000, units));
    for (const it of items) {
      if (it.measure === 'reps' || it.measure === 'reps_weight') {
        errors[`${it.key}:reps`] = numberError(it.reps, { min: 1, max: 1000, integer: true });
      } else {
        errors[`${it.key}:time`] = numberError(it.time, it.timeUnit === 'min' ? { min: 1, max: 600, unit: 'min' } : { min: 1, max: 3600, integer: true, unit: 'sec' });
      }
      if (it.measure === 'reps_weight') errors[`${it.key}:weight`] = numberError(it.weight, { positive: true, max: maxWeight, unit: units.weight });
      errors[`${it.key}:rest`] = numberError(it.rest, { label: 'a rest time', required: true, min: 0, max: 1800, integer: true, unit: 'sec' });
    }
    if (!form.apply(errors)) return;
    const template: WorkoutTemplate = {
      name: name.trim(),
      weekdays,
      notes: notes.trim() || undefined,
      items: items.map((it) => {
        const t = parseNumber(it.time);
        const w = parseNumber(it.weight);
        return {
          exerciseId: it.exerciseId,
          name: it.name,
          measure: it.measure,
          sets: it.sets,
          reps: parseNumber(it.reps),
          weightKg: w !== null ? weight.fromDisplay(w, units) : null,
          durationSec: t !== null ? (it.timeUnit === 'min' ? t * 60 : t) : null,
          restSec: parseNumber(it.rest) ?? 60,
        };
      }),
    };
    try {
      if (id && existing.data) await repos.workoutTemplates.update(id, template);
      else await repos.workoutTemplates.create(template);
      router.back();
    } catch (e) {
      showError(e);
    }
  };

  return (
    <Screen keyboard footer={<Button full label="Save workout" onPress={save} />}>
      <Stack.Screen options={{ title: id ? 'Edit workout' : 'New workout' }} />
      <Field
        label="Name"
        value={name}
        onChangeText={(v) => {
          setName(v);
          form.clear('name');
        }}
        placeholder="e.g. Full body A"
        maxLength={LIMITS.short}
        error={form.errors.name}
      />
      <Txt variant="label" tone="muted">
        Scheduled days
      </Txt>
      <WeekdayPicker value={weekdays} onChange={setWeekdays} />

      {items.map((it, i) => (
        <Card key={it.key} padding={16}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Txt variant="heading" style={{ flex: 1 }}>
              {it.name}
            </Txt>
            <IconButton icon="chevron-up" tone="clear" size={30} label="Move up" onPress={() => move(i, -1)} />
            <IconButton icon="chevron-down" tone="clear" size={30} label="Move down" onPress={() => move(i, 1)} />
            <IconButton icon="close" tone="clear" size={30} label="Remove" onPress={() => setItems((xs) => xs.filter((x) => x.key !== it.key))} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
            <Txt variant="label" tone="muted">
              Sets
            </Txt>
            <Stepper label="sets" value={it.sets} min={1} max={20} onChange={(v) => patch(it.key, { sets: v })} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            {it.measure === 'reps' || it.measure === 'reps_weight' ? (
              <View style={{ flex: 1 }}>
                <Field label="Target reps" value={it.reps} onChangeText={(v) => patch(it.key, { reps: v })} keyboardType="number-pad" error={err(it.key, 'reps')} />
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <Field label="Target time" value={it.time} onChangeText={(v) => patch(it.key, { time: v })} keyboardType="number-pad" suffix={it.timeUnit} error={err(it.key, 'time')} />
              </View>
            )}
            {it.measure === 'reps_weight' ? (
              <View style={{ flex: 1 }}>
                <Field label="Weight" value={it.weight} onChangeText={(v) => patch(it.key, { weight: v })} keyboardType="decimal-pad" suffix={units.weight} error={err(it.key, 'weight')} />
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <Field label="Rest" value={it.rest} onChangeText={(v) => patch(it.key, { rest: v })} keyboardType="number-pad" suffix="sec" error={err(it.key, 'rest')} />
            </View>
          </View>
        </Card>
      ))}

      <FieldError message={form.errors.items} />
      <Button label="Add exercise" icon="add" variant="secondary" onPress={() => router.push({ pathname: '/workouts/library', params: { pick: 'builder' } })} />
      <Field
        label="Notes"
        value={notes}
        onChangeText={(v) => {
          setNotes(v);
          form.clear('notes');
        }}
        multiline
        maxLength={LIMITS.note}
        error={form.errors.notes}
      />
      <FormErrorSummary count={form.count} />
      {id && existing.data ? (
        <Button
          label="Delete workout"
          variant="danger"
          icon="trash-outline"
          onPress={() =>
            confirmDelete('this workout', async () => {
              await repos.workoutTemplates.remove(id);
              router.back();
            }, 'Your past sessions stay in your history.')
          }
        />
      ) : null}
    </Screen>
  );
}
