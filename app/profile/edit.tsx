import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { Banner, Button, ChipMulti, DateTimeField, Field, Screen, SectionHeader } from '../../src/components/ui';
import { displayRange } from '../../src/features/health/definitions';
import { useProfile } from '../../src/stores/profileStore';
import { dateKey, parseDateKey } from '../../src/utils/date';
import { ALLERGENS, DIET_PREFERENCES } from '../../src/utils/nutrition';
import { height, num, parseNumber } from '../../src/utils/units';
import { LIMITS, check, dobError, useFormErrors, validate } from '../../src/utils/validation';

export default function EditProfile() {
  const p = useProfile();
  const [name, setName] = useState(p.name);
  const [dob, setDob] = useState<Date | null>(p.dateOfBirth ? parseDateKey(p.dateOfBirth) : null);
  const [h, setH] = useState(p.heightCm ? num(height.toDisplay(p.heightCm, p.units), 1) : '');
  const [allergies, setAllergies] = useState(p.diet.allergies);
  const [prefs, setPrefs] = useState(p.diet.preferences);
  const form = useFormErrors<'name' | 'dob' | 'height'>();

  const save = () => {
    const ok = form.apply({
      ...validate(
        { name, height: h },
        {
          name: [check.required('your name'), check.personName(), check.minLength(2, 'Your name needs at least 2 letters.'), check.maxLength(LIMITS.name)],
          height: [check.number({ label: 'your height', required: true, ...displayRange('height', p.units), integer: p.units.height === 'ftin' })],
        },
      ),
      dob: dobError(dob),
    });
    if (!ok) return;
    const hv = parseNumber(h);
    p.update({ name: name.trim(), dateOfBirth: dob ? dateKey(dob) : null, heightCm: hv ? height.fromDisplay(hv, p.units) : null, diet: { allergies, preferences: prefs } });
    router.back();
  };

  return (
    <Screen keyboard footer={<Button full label="Save" onPress={save} />}>
      <Stack.Screen options={{ title: 'Personal details' }} />
      <Field
        label="Name"
        value={name}
        onChangeText={(v) => {
          setName(v);
          form.clear('name');
        }}
        autoCapitalize="words"
        maxLength={LIMITS.name}
        error={form.errors.name}
      />
      <DateTimeField
        label="Date of birth"
        mode="date"
        value={dob}
        onChange={(d) => {
          setDob(d);
          form.clear('dob');
        }}
        maximumDate={new Date()}
        placeholder="Not set"
        onClear={() => setDob(null)}
        error={form.errors.dob}
      />
      <Field
        label="Height"
        value={h}
        onChangeText={(v) => {
          setH(v);
          form.clear('height');
        }}
        keyboardType="decimal-pad"
        suffix={height.unit(p.units)}
        hint={p.units.height === 'ftin' ? 'Total inches, e.g. 69 for 5 ft 9 in.' : undefined}
        error={form.errors.height}
      />
      <SectionHeader title="Allergies" />
      <ChipMulti options={ALLERGENS.map((a) => ({ label: a.label, value: a.id }))} values={allergies} onChange={setAllergies} />
      <SectionHeader title="Dietary preferences" />
      <ChipMulti options={DIET_PREFERENCES.map((a) => ({ label: a.label, value: a.id }))} values={prefs} onChange={setPrefs} />
      <Banner body="Food allergies are used to flag foods in search. Record medicine and other allergies in Health records." />
    </Screen>
  );
}
