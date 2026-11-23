import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { Button, ChipMulti, ChipSelect, Field, FieldError, Screen, Txt } from '../../src/components/ui';
import { CATEGORIES } from '../../src/features/workouts/library';
import { useExercises } from '../../src/features/workouts/useExercises';
import { repos } from '../../src/repositories';
import type { Difficulty, ExerciseCategory, ExerciseMeasure, WorkoutSetting } from '../../src/types/models';
import { showError } from '../../src/utils/alerts';
import { parseNumber } from '../../src/utils/units';
import { LIMITS, check, useFormErrors, validate } from '../../src/utils/validation';

type Key = 'name' | 'settings' | 'muscles' | 'equipment' | 'rest' | 'instructions';

export default function CustomExercise() {
  const exercises = useExercises();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ExerciseCategory>('strength');
  const [measure, setMeasure] = useState<ExerciseMeasure>('reps_weight');
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner');
  const [settings, setSettings] = useState<WorkoutSetting[]>(['home', 'gym']);
  const [muscles, setMuscles] = useState('');
  const [equipment, setEquipment] = useState('');
  const [instructions, setInstructions] = useState('');
  const [rest, setRest] = useState('60');
  const form = useFormErrors<Key>();
  const edit = (key: Key, setter: (v: string) => void) => (v: string) => {
    setter(v);
    form.clear(key);
  };

  const save = async () => {
    const errors = validate(
      { name, muscles, equipment, rest, instructions },
      {
        name: [check.required('a name for the exercise'), check.text(), check.maxLength(LIMITS.short)],
        muscles: [check.maxLength(200)],
        equipment: [check.maxLength(200)],
        rest: [check.number({ label: 'a rest time', required: true, min: 0, max: 1800, integer: true, unit: 'sec' })],
        instructions: [check.maxLength(2000)],
      },
    );
    if (!errors.name && exercises.some((e) => e.name.trim().toLowerCase() === name.trim().toLowerCase())) {
      errors.name = 'There’s already an exercise with this name in the library.';
    }
    if (!form.apply({ ...errors, settings: settings.length === 0 ? 'Choose home, gym or both.' : null })) return;
    const split = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
    try {
      await repos.customExercises.create({
        name: name.trim(),
        category,
        measure,
        difficulty,
        settings,
        muscles: split(muscles),
        equipment: split(equipment).length ? split(equipment) : ['None'],
        instructions: instructions.split('\n').map((x) => x.trim()).filter(Boolean),
        defaults: { sets: 3, reps: measure.startsWith('reps') ? 10 : undefined, durationSec: measure === 'time' ? 30 : undefined, restSec: parseNumber(rest) ?? 60 },
      });
      router.back();
    } catch (e) {
      showError(e);
    }
  };

  return (
    <Screen keyboard footer={<Button full label="Save exercise" onPress={save} />}>
      <Stack.Screen options={{ title: 'Custom exercise' }} />
      <Field label="Name" value={name} onChangeText={edit('name', setName)} autoFocus maxLength={LIMITS.short} error={form.errors.name} />
      <Txt variant="label" tone="muted">Category</Txt>
      <ChipSelect options={CATEGORIES.map((c) => ({ label: c.label, value: c.id }))} value={category} onChange={(v) => v && setCategory(v)} />
      <Txt variant="label" tone="muted">Track it by</Txt>
      <ChipSelect
        options={[
          { label: 'Reps and weight', value: 'reps_weight' },
          { label: 'Reps', value: 'reps' },
          { label: 'Time', value: 'time' },
          { label: 'Distance', value: 'distance' },
        ]}
        value={measure}
        onChange={(v) => v && setMeasure(v)}
      />
      <Txt variant="label" tone="muted">Difficulty</Txt>
      <ChipSelect
        options={[
          { label: 'Beginner', value: 'beginner' },
          { label: 'Intermediate', value: 'intermediate' },
          { label: 'Advanced', value: 'advanced' },
        ]}
        value={difficulty}
        onChange={(v) => v && setDifficulty(v)}
      />
      <Txt variant="label" tone={form.errors.settings ? 'danger' : 'muted'}>Where</Txt>
      <ChipMulti
        options={[{ label: 'Home', value: 'home' }, { label: 'Gym', value: 'gym' }]}
        values={settings}
        onChange={(v) => {
          setSettings(v);
          form.clear('settings');
        }}
      />
      <FieldError message={form.errors.settings} />
      <Field label="Muscles" value={muscles} onChangeText={edit('muscles', setMuscles)} placeholder="Comma separated, e.g. Glutes, Hamstrings" maxLength={200} error={form.errors.muscles} />
      <Field label="Equipment" value={equipment} onChangeText={edit('equipment', setEquipment)} placeholder="Comma separated" maxLength={200} error={form.errors.equipment} />
      <Field label="Default rest" value={rest} onChangeText={edit('rest', setRest)} keyboardType="number-pad" suffix="sec" error={form.errors.rest} />
      <Field label="Instructions" value={instructions} onChangeText={edit('instructions', setInstructions)} multiline placeholder="One step per line" maxLength={2000} error={form.errors.instructions} />
    </Screen>
  );
}
