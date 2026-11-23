import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Banner, Button, Field, FormErrorSummary, Screen, SectionHeader } from '../../src/components/ui';
import { GOAL_RULES } from '../../src/features/goals';
import { useProfile, type Goals } from '../../src/stores/profileStore';
import { num, parseNumber, volume, weight } from '../../src/utils/units';
import { check, useFormErrors, validate, type Check } from '../../src/utils/validation';

type Key = keyof Goals;
const KEYS: Key[] = ['steps', 'activeMinutes', 'workoutsPerWeek', 'calories', 'proteinG', 'carbsG', 'fatG', 'waterMl', 'sleepHours', 'targetWeightKg'];

export default function GoalsScreen() {
  const goals = useProfile((s) => s.goals);
  const units = useProfile((s) => s.units);
  const setGoals = useProfile((s) => s.setGoals);
  const form = useFormErrors<Key>();
  const show = (v: number | null, conv?: (n: number) => number) => (v === null ? '' : num(conv ? conv(v) : v, 1));
  const [f, setF] = useState<Record<Key, string>>({
    steps: show(goals.steps),
    activeMinutes: show(goals.activeMinutes),
    workoutsPerWeek: show(goals.workoutsPerWeek),
    calories: show(goals.calories),
    proteinG: show(goals.proteinG),
    carbsG: show(goals.carbsG),
    fatG: show(goals.fatG),
    waterMl: show(goals.waterMl, (v) => volume.toDisplay(v, units)),
    sleepHours: show(goals.sleepHours),
    targetWeightKg: show(goals.targetWeightKg, (v) => weight.toDisplay(v, units)),
  });
  const set = (k: Key) => (v: string) => {
    setF((x) => ({ ...x, [k]: v }));
    form.clear(k);
  };
  const field = (k: Key, label: string, keyboard: 'number-pad' | 'decimal-pad' = 'number-pad') => {
    const rule = GOAL_RULES[k](units);
    return <Field label={label} value={f[k]} onChangeText={set(k)} keyboardType={keyboard} suffix={rule.unit} error={form.errors[k]} />;
  };

  const save = () => {
    const schema = Object.fromEntries(KEYS.map((k) => [k, [check.number(GOAL_RULES[k](units))]])) as Partial<Record<Key, Check[]>>;
    const errors = validate(f, schema);
    // Cross-check: macronutrient goals shouldn't add up to far more energy than the energy goal.
    const kcal = parseNumber(f.calories);
    const p = parseNumber(f.proteinG);
    const c = parseNumber(f.carbsG);
    const fat = parseNumber(f.fatG);
    if (!errors.calories && kcal && p && c && fat) {
      const fromMacros = p * 4 + c * 4 + fat * 9;
      if (fromMacros > kcal * 1.15) {
        errors.calories = `Your protein, carbs and fat add up to about ${Math.round(fromMacros).toLocaleString()} kcal, more than this goal. Lower one of them or raise the goal.`;
      }
    }
    if (!form.apply(errors)) return;
    const read = (k: Key) => parseNumber(f[k]);
    const w = read('waterMl');
    const t = read('targetWeightKg');
    setGoals({
      steps: read('steps'),
      activeMinutes: read('activeMinutes'),
      workoutsPerWeek: read('workoutsPerWeek'),
      calories: read('calories'),
      proteinG: read('proteinG'),
      carbsG: read('carbsG'),
      fatG: read('fatG'),
      waterMl: w !== null ? Math.round(volume.fromDisplay(w, units)) : null,
      sleepHours: read('sleepHours'),
      targetWeightKg: t !== null ? weight.fromDisplay(t, units) : null,
    });
    router.back();
  };

  return (
    <Screen keyboard footer={<Button full label="Save goals" onPress={save} />}>
      <Stack.Screen options={{ title: 'Goals' }} />
      <Banner body="Leave a goal blank if you don’t want one. Targets that suit you depend on your body, health and circumstances; a professional can help you choose them." />
      <FormErrorSummary count={form.count} />
      <SectionHeader title="Activity" />
      {field('steps', 'Daily steps')}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>{field('activeMinutes', 'Active minutes a day')}</View>
        <View style={{ flex: 1 }}>{field('workoutsPerWeek', 'Workouts a week')}</View>
      </View>
      <SectionHeader title="Nutrition" />
      {field('calories', 'Daily energy')}
      {field('proteinG', 'Protein', 'decimal-pad')}
      {field('carbsG', 'Carbohydrates', 'decimal-pad')}
      {field('fatG', 'Fat', 'decimal-pad')}
      {field('waterMl', 'Daily water', 'decimal-pad')}
      <SectionHeader title="Rest and body" />
      {field('sleepHours', 'Sleep a night', 'decimal-pad')}
      {field('targetWeightKg', 'Target weight', 'decimal-pad')}
    </Screen>
  );
}
