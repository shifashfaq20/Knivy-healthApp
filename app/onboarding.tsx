import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, ChipMulti, DateTimeField, Field, FormErrorSummary, Segmented, Screen, ToggleRow, Txt } from '../src/components/ui';
import { GOAL_RULES } from '../src/features/goals';
import { displayRange } from '../src/features/health/definitions';
import { repos } from '../src/repositories';
import { useProfile } from '../src/stores/profileStore';
import { colors } from '../src/theme/tokens';
import { showError } from '../src/utils/alerts';
import { dateKey, parseDateKey } from '../src/utils/date';
import { ALLERGENS, DIET_PREFERENCES } from '../src/utils/nutrition';
import { height, parseNumber, volume, weight, type UnitPrefs } from '../src/utils/units';
import { LIMITS, check, dobError, useFormErrors, validate } from '../src/utils/validation';

type StepId = 'welcome' | 'you' | 'body' | 'goals' | 'private';
const STEPS: { id: StepId }[] = [{ id: 'welcome' }, { id: 'you' }, { id: 'body' }, { id: 'goals' }, { id: 'private' }];

type Key = 'name' | 'dob' | 'height' | 'weight' | 'steps' | 'water' | 'calories';

export default function Onboarding() {
  const profile = useProfile();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile.name);
  const [dob, setDob] = useState<Date | null>(profile.dateOfBirth ? parseDateKey(profile.dateOfBirth) : null);
  const [units, setUnitsState] = useState<UnitPrefs>(profile.units);
  const [heightText, setHeightText] = useState('');
  const [weightText, setWeightText] = useState('');
  const [stepsGoal, setStepsGoal] = useState('');
  const [waterGoal, setWaterGoal] = useState('');
  const [calorieGoal, setCalorieGoal] = useState('');
  const [allergies, setAllergies] = useState<string[]>(profile.diet.allergies);
  const [prefs, setPrefs] = useState<string[]>(profile.diet.preferences);
  const [cycle, setCycle] = useState(profile.features.cycleTracking);
  const [saving, setSaving] = useState(false);
  const form = useFormErrors<Key>();

  const current = STEPS[step];
  const edit = (key: Key, setter: (v: string) => void) => (v: string) => {
    setter(v);
    form.clear(key);
  };
  const setUnits = (u: UnitPrefs) => {
    setUnitsState(u);
    form.clear('height');
    form.clear('weight');
  };

  const stepIsValid = () => {
    if (current.id === 'you') {
      return form.apply({ ...validate({ name }, { name: [check.required('your name'), check.personName(), check.minLength(2, 'Your name needs at least 2 letters.'), check.maxLength(LIMITS.name)] }), dob: dobError(dob) });
    }
    if (current.id === 'body') {
      return form.apply(
        validate(
          { height: heightText, weight: weightText },
          {
            height: [check.number({ label: 'your height', required: true, ...displayRange('height', units), integer: units.height === 'ftin' })],
            weight: [check.number({ label: 'your weight', required: true, ...displayRange('weight', units) })],
          },
        ),
      );
    }
    if (current.id === 'goals') {
      return form.apply(
        validate(
          { steps: stepsGoal, water: waterGoal, calories: calorieGoal },
          {
            steps: [check.number(GOAL_RULES.steps(units))],
            water: [check.number(GOAL_RULES.waterMl(units))],
            calories: [check.number(GOAL_RULES.calories(units))],
          },
        ),
      );
    }
    return form.apply({});
  };

  const next = () => {
    if (stepIsValid()) setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };
  const back = () => {
    form.apply({});
    setStep((s) => Math.max(0, s - 1));
  };

  const finish = async () => {
    // Required answers can't be skipped, even by going back and clearing them.
    if (!name.trim()) {
      setStep(STEPS.findIndex((s) => s.id === 'you'));
      form.apply({ name: 'Enter your name.' });
      return;
    }
    if (!parseNumber(heightText) || !parseNumber(weightText)) {
      setStep(STEPS.findIndex((s) => s.id === 'body'));
      form.apply({ height: parseNumber(heightText) ? null : 'Enter your height.', weight: parseNumber(weightText) ? null : 'Enter your weight.' });
      return;
    }
    setSaving(true);
    try {
      const h = parseNumber(heightText);
      const w = parseNumber(weightText);
      const heightCm = h ? height.fromDisplay(h, units) : null;
      if (w) await repos.measurements.create({ type: 'weight', value: weight.fromDisplay(w, units) }, { source: 'manual' });
      if (heightCm) await repos.measurements.create({ type: 'height', value: heightCm }, { source: 'manual' });
      const s = parseNumber(stepsGoal);
      const wg = parseNumber(waterGoal);
      const c = parseNumber(calorieGoal);
      profile.update({
        name: name.trim(),
        dateOfBirth: dob ? dateKey(dob) : null,
        heightCm,
        units,
        diet: { allergies, preferences: prefs },
        features: { ...profile.features, cycleTracking: cycle },
        onboarded: true,
      });
      profile.setGoals({
        steps: s ? Math.round(s) : null,
        waterMl: wg ? Math.round(volume.fromDisplay(wg, units)) : null,
        calories: c ? Math.round(c) : null,
      });
      router.replace('/(tabs)');
    } catch (e) {
      showError(e, 'Couldn’t finish setting up');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      tab
      keyboard
      footer={
        <View style={{ gap: 10 }}>
        <FormErrorSummary count={form.count} message={form.count === 1 ? Object.values(form.errors).find(Boolean) : undefined} />
        <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
          {step > 0 ? <Button label="Back" variant="ghost" onPress={back} /> : <View />}
          {step < STEPS.length - 1 ? (
            <Button label={step === 0 ? 'Get started' : 'Continue'} onPress={next} />
          ) : (
            <Button label="Start using Knivy" onPress={finish} loading={saving} />
          )}
        </View>
        </View>
      }
    >
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }} accessibilityLabel={`Step ${step + 1} of ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <View key={s.id} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= step ? colors.ink : colors.sand }} />
        ))}
      </View>

      {current.id === 'welcome' ? (
        <View style={{ gap: 18, marginTop: 24 }}>
          <Txt variant="numberLarge">Knivy</Txt>
          <Txt variant="title">One quiet place for your health, food, movement and rest.</Txt>
          <Txt tone="muted">
            Knivy only shows what you record or what your phone measures. If something hasn’t been measured, you’ll see that instead of a guess.
          </Txt>
          <Card tone="linen">
            <View style={{ gap: 8 }}>
              <Txt variant="heading">Before you start</Txt>
              <Txt tone="muted">
                Knivy is a wellness tool, not a medical device. It doesn’t diagnose conditions or replace your doctor. In an emergency, call your local emergency number.
              </Txt>
              <Txt tone="muted">Everything you enter stays on this phone. Knivy is free, with no subscriptions.</Txt>
            </View>
          </Card>
          <Txt variant="caption" tone="muted">Version {Constants.expoConfig?.version ?? '0.2.0'}</Txt>
        </View>
      ) : null}

      {current.id === 'you' ? (
        <View style={{ gap: 16 }}>
          <Txt variant="title">About you</Txt>
          <Txt tone="muted">Your name is needed to set up your profile. Date of birth is optional and helps put trends in context.</Txt>
          <Field
            label="What should we call you?"
            value={name}
            onChangeText={edit('name', setName)}
            placeholder="Your first name"
            autoCapitalize="words"
            maxLength={LIMITS.name}
            error={form.errors.name}
          />
          <DateTimeField
            label="Date of birth (optional)"
            value={dob}
            onChange={(d) => {
              setDob(d);
              form.clear('dob');
            }}
            mode="date"
            maximumDate={new Date()}
            placeholder="Not set"
            onClear={() => setDob(null)}
            error={form.errors.dob}
          />
        </View>
      ) : null}

      {current.id === 'body' ? (
        <View style={{ gap: 16 }}>
          <Txt variant="title">Units and body</Txt>
          <Txt tone="muted">Height and weight are needed for BMI and energy estimates. You can update them any time.</Txt>
          <Txt variant="label" tone="muted">Weight</Txt>
          <Segmented options={[{ label: 'kg', value: 'kg' }, { label: 'lb', value: 'lb' }]} value={units.weight} onChange={(v) => setUnits({ ...units, weight: v })} />
          <Txt variant="label" tone="muted">Height</Txt>
          <Segmented options={[{ label: 'cm', value: 'cm' }, { label: 'ft / in', value: 'ftin' }]} value={units.height} onChange={(v) => setUnits({ ...units, height: v })} />
          <Txt variant="label" tone="muted">Distance</Txt>
          <Segmented options={[{ label: 'km', value: 'km' }, { label: 'miles', value: 'mi' }]} value={units.distance} onChange={(v) => setUnits({ ...units, distance: v })} />
          <Txt variant="label" tone="muted">Liquids</Txt>
          <Segmented options={[{ label: 'ml', value: 'ml' }, { label: 'fl oz', value: 'oz' }]} value={units.volume} onChange={(v) => setUnits({ ...units, volume: v })} />
          <Txt variant="label" tone="muted">Temperature</Txt>
          <Segmented options={[{ label: '°C', value: 'c' }, { label: '°F', value: 'f' }]} value={units.temperature} onChange={(v) => setUnits({ ...units, temperature: v })} />
          <Field
            label="Height"
            value={heightText}
            onChangeText={edit('height', setHeightText)}
            keyboardType="decimal-pad"
            suffix={height.unit(units)}
            hint={units.height === 'ftin' ? 'Enter total inches, e.g. 69 for 5 ft 9 in.' : undefined}
            error={form.errors.height}
          />
          <Field
            label="Current weight"
            value={weightText}
            onChangeText={edit('weight', setWeightText)}
            keyboardType="decimal-pad"
            suffix={weight.unit(units)}
            error={form.errors.weight}
          />
        </View>
      ) : null}

      {current.id === 'goals' ? (
        <View style={{ gap: 16 }}>
          <Txt variant="title">Goals, if you want them</Txt>
          <Txt tone="muted">
            There’s no single right number. Leave any of these blank and set them later, ideally with advice from a professional who knows you.
          </Txt>
          <Field label="Daily steps" value={stepsGoal} onChangeText={edit('steps', setStepsGoal)} keyboardType="number-pad" suffix="steps" error={form.errors.steps} />
          <Field
            label="Daily water"
            value={waterGoal}
            onChangeText={edit('water', setWaterGoal)}
            keyboardType="decimal-pad"
            suffix={volume.unit(units)}
            hint="Needs vary with body size, climate, activity and health."
            error={form.errors.water}
          />
          <Field label="Daily calories" value={calorieGoal} onChangeText={edit('calories', setCalorieGoal)} keyboardType="number-pad" suffix="kcal" error={form.errors.calories} />
        </View>
      ) : null}

      {current.id === 'private' ? (
        <View style={{ gap: 16 }}>
          <Txt variant="title">Food and optional features</Txt>
          <Txt variant="label" tone="muted">Allergies to flag in food search</Txt>
          <ChipMulti options={ALLERGENS.map((a) => ({ label: a.label, value: a.id }))} values={allergies} onChange={setAllergies} />
          <Txt variant="label" tone="muted">Dietary preferences</Txt>
          <ChipMulti options={DIET_PREFERENCES.map((a) => ({ label: a.label, value: a.id }))} values={prefs} onChange={setPrefs} />
          <Card tone="linen">
            <ToggleRow label="Cycle tracking" description="Log periods and symptoms privately. You can turn this on or off any time." value={cycle} onChange={setCycle} />
          </Card>
        </View>
      ) : null}
    </Screen>
  );
}
