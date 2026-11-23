import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Button, ChipSelect, DateTimeField, Field, Screen, Txt } from '../../src/components/ui';
import { MEASUREMENTS, displayRange } from '../../src/features/health/definitions';
import { repos } from '../../src/repositories';
import { useProfile } from '../../src/stores/profileStore';
import type { MeasurementType } from '../../src/types/models';
import { showError } from '../../src/utils/alerts';
import { parseNumber } from '../../src/utils/units';
import { LIMITS, check, futureError, useFormErrors, validate } from '../../src/utils/validation';

const TYPES: MeasurementType[] = ['weight', 'heart_rate', 'resting_heart_rate', 'blood_pressure', 'spo2', 'temperature', 'height', 'steps'];
type Key = 'value' | 'value2' | 'when' | 'note';

export default function AddMeasurement() {
  const params = useLocalSearchParams<{ type?: string }>();
  const initial = (params.type && params.type in MEASUREMENTS ? params.type : 'weight') as MeasurementType;
  const units = useProfile((s) => s.units);
  const update = useProfile((s) => s.update);
  const [type, setType] = useState<MeasurementType>(initial);
  const [value, setValue] = useState('');
  const [value2, setValue2] = useState('');
  const [when, setWhen] = useState(new Date());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const form = useFormErrors<Key>();
  const def = MEASUREMENTS[type];

  const save = async () => {
    const range = displayRange(type, units);
    const errors = validate(
      { value, value2, note },
      {
        value: [
          check.number({
            label: def.twoValues ? 'the top number' : `your ${def.label.toLowerCase()}`,
            required: true,
            integer: def.decimals === 0 && type !== 'height',
            ...range,
          }),
        ],
        value2: def.twoValues ? [check.number({ label: 'the bottom number', required: true, min: 30, max: 160, integer: true, unit: 'mmHg' })] : [],
        note: [check.maxLength(LIMITS.title)],
      },
    );
    const v = parseNumber(value);
    const v2 = parseNumber(value2);
    if (def.twoValues && !errors.value && !errors.value2 && v !== null && v2 !== null && v2 >= v) {
      errors.value2 = 'The bottom number should be lower than the top number.';
    }
    if (!form.apply({ ...errors, when: futureError(when, 'The time') })) return;
    setSaving(true);
    try {
      const canonical = def.fromDisplay(v!, units);
      await repos.measurements.create(
        { type, value: canonical, value2: def.twoValues ? v2 : null, note: note.trim() || undefined },
        { recordedAt: when.toISOString(), source: 'manual' },
      );
      if (type === 'height') update({ heightCm: canonical });
      router.back();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen keyboard footer={<Button full label="Save reading" onPress={save} loading={saving} />}>
      <Stack.Screen options={{ title: 'Add a reading' }} />
      <ChipSelect
        options={TYPES.map((t) => ({ label: MEASUREMENTS[t].label, value: t }))}
        value={type}
        onChange={(t) => {
          if (!t) return;
          setType(t);
          form.apply({});
        }}
      />
      {def.twoValues ? (
        <>
          <Field
            label="Systolic (top number)"
            value={value}
            onChangeText={(x) => {
              setValue(x);
              form.clear('value');
            }}
            keyboardType="number-pad"
            suffix="mmHg"
            autoFocus
            error={form.errors.value}
          />
          <Field
            label="Diastolic (bottom number)"
            value={value2}
            onChangeText={(x) => {
              setValue2(x);
              form.clear('value2');
            }}
            keyboardType="number-pad"
            suffix="mmHg"
            error={form.errors.value2}
          />
        </>
      ) : (
        <Field
          label={def.label}
          value={value}
          onChangeText={(x) => {
            setValue(x);
            form.clear('value');
          }}
          keyboardType={def.decimals > 0 ? 'decimal-pad' : 'number-pad'}
          suffix={def.unit(units)}
          hint={type === 'height' && units.height === 'ftin' ? 'Enter total inches, e.g. 69 for 5 ft 9 in.' : undefined}
          autoFocus
          error={form.errors.value}
        />
      )}
      <DateTimeField
        label="When"
        value={when}
        onChange={(d) => {
          setWhen(d);
          form.clear('when');
        }}
        maximumDate={new Date()}
        error={form.errors.when}
      />
      <Field
        label="Note (optional)"
        value={note}
        onChangeText={(x) => {
          setNote(x);
          form.clear('note');
        }}
        placeholder="e.g. after a walk"
        maxLength={LIMITS.title}
        error={form.errors.note}
      />
      {def.hint ? (
        <Txt variant="caption" tone="muted">
          {def.hint}
        </Txt>
      ) : null}
      <Txt variant="caption" tone="muted">
        Readings are for your own tracking. If a reading worries you, speak to a health professional.
      </Txt>
    </Screen>
  );
}
