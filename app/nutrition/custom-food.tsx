import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, ChipMulti, Field, FormErrorSummary, Screen, Segmented, Txt } from '../../src/components/ui';
import { repos } from '../../src/repositories';
import type { FoodItem, Nutrients } from '../../src/types/models';
import { showError } from '../../src/utils/alerts';
import { newId } from '../../src/utils/id';
import { ALLERGENS, NUTRIENT_KEYS, NUTRIENT_META, emptyNutrients } from '../../src/utils/nutrition';
import { parseNumber } from '../../src/utils/units';
import { LIMITS, check, gtinError, useFormErrors, validate, type Check } from '../../src/utils/validation';

type NKey = keyof Nutrients;
type Key = 'name' | 'brand' | 'barcode' | 'servingSize' | 'servingLabel' | NKey;

/** Nothing can contain more than this per 100 g (pure fat is ~900 kcal; pure salt is ~39,000 mg sodium). */
const PER100_MAX: Record<NKey, number> = { energyKcal: 900, proteinG: 100, carbsG: 100, fatG: 100, fiberG: 100, sugarG: 100, saturatedFatG: 100, sodiumMg: 40000 };
const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });

export default function CustomFood() {
  const params = useLocalSearchParams<{ barcode?: string }>();
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [barcode, setBarcode] = useState(params.barcode ?? '');
  const [basis, setBasis] = useState<'g' | 'ml'>('g');
  const [per, setPer] = useState<'100' | 'serving'>('serving');
  const [servingLabel, setServingLabel] = useState('');
  const [servingSize, setServingSize] = useState('');
  const [values, setValues] = useState<Record<NKey, string>>(() => Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, ''])) as Record<NKey, string>);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [allergenKnown, setAllergenKnown] = useState<'yes' | 'no'>('no');
  const form = useFormErrors<Key>();
  const edit = (key: Key, setter: (v: string) => void) => (v: string) => {
    setter(v);
    form.clear(key);
  };

  const save = async () => {
    const schema: Partial<Record<Key, Check[]>> = {
      name: [check.required('the food name'), check.text(), check.maxLength(LIMITS.title)],
      brand: [check.text(), check.maxLength(LIMITS.short)],
      servingLabel: [check.maxLength(40)],
      servingSize: [check.number({ label: 'the serving size', required: per === 'serving', positive: true, max: 5000, unit: basis })],
    };
    for (const k of NUTRIENT_KEYS) schema[k] = [check.number({ min: 0, unit: NUTRIENT_META[k].unit })];
    const errors = validate({ name, brand, barcode, servingSize, servingLabel, ...values }, schema);
    if (barcode.trim()) errors.barcode = gtinError(barcode) ?? undefined;
    if (!NUTRIENT_KEYS.some((k) => values[k].trim())) errors.energyKcal = 'Enter at least one value from the label, such as energy.';

    // Convert to per 100 and check what's physically possible.
    const size = parseNumber(servingSize);
    const factor = per === 'serving' ? (size && size > 0 ? 100 / size : null) : 1;
    const per100 = emptyNutrients();
    if (factor) {
      for (const k of NUTRIENT_KEYS) {
        const v = parseNumber(values[k]);
        if (v === null || errors[k]) continue;
        per100[k] = v * factor;
        if (per100[k]! > PER100_MAX[k]) {
          const unit = NUTRIENT_META[k].unit;
          errors[k] =
            per === 'serving'
              ? `That’s ${fmt(per100[k]!)} ${unit} per 100 ${basis}, more than any food contains. Check this value and the serving size.`
              : `No food has more than ${fmt(PER100_MAX[k])} ${unit} per 100 ${basis}. Check the value.`;
        }
      }
      const g = (k: NKey) => per100[k] ?? 0;
      if (!errors.sugarG && per100.sugarG !== null && per100.carbsG !== null && g('sugarG') > g('carbsG') + 0.5)
        errors.sugarG = 'Sugars are part of carbohydrates, so they can’t be higher than carbohydrates.';
      if (!errors.saturatedFatG && per100.saturatedFatG !== null && per100.fatG !== null && g('saturatedFatG') > g('fatG') + 0.5)
        errors.saturatedFatG = 'Saturated fat is part of total fat, so it can’t be higher than fat.';
      if (!errors.fatG && g('proteinG') + g('carbsG') + g('fatG') > 101)
        errors.fatG = `Protein, carbohydrates and fat add up to more than 100 g per 100 ${basis}. Check these values.`;
    }
    if (!form.apply(errors)) return;

    const id = newId();
    const servings = [{ label: `100 ${basis}`, grams: 100 }];
    if (size && size > 0) servings.unshift({ label: servingLabel.trim() || `1 serving (${size} ${basis})`, grams: size });
    const food: FoodItem = {
      key: `custom:${id}`,
      provider: 'custom',
      providerId: id,
      name: name.trim(),
      brand: brand.trim() || null,
      barcode: barcode.replace(/\s/g, '') || null,
      per100g: per100,
      basis,
      servings,
      allergens: allergenKnown === 'yes' ? allergens : null,
      dietTags: null,
    };
    try {
      await repos.customFoods.create({ food });
      router.back();
    } catch (e) {
      showError(e);
    }
  };

  return (
    <Screen keyboard footer={<Button full label="Save food" onPress={save} />}>
      <Stack.Screen options={{ title: 'Create a food' }} />
      <Txt tone="muted">Copy the values from the package label. Leave anything blank that isn’t listed; it’ll show as not available.</Txt>
      <Field label="Name" value={name} onChangeText={edit('name', setName)} maxLength={LIMITS.title} error={form.errors.name} />
      <Field label="Brand (optional)" value={brand} onChangeText={edit('brand', setBrand)} maxLength={LIMITS.short} error={form.errors.brand} />
      <Field label="Barcode (optional)" value={barcode} onChangeText={edit('barcode', setBarcode)} keyboardType="number-pad" maxLength={14} error={form.errors.barcode} />
      <Txt variant="label" tone="muted">Measured in</Txt>
      <Segmented options={[{ label: 'Grams', value: 'g' }, { label: 'Millilitres', value: 'ml' }]} value={basis} onChange={setBasis} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Field label="Serving size" value={servingSize} onChangeText={edit('servingSize', setServingSize)} keyboardType="decimal-pad" suffix={basis} error={form.errors.servingSize} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Serving name" value={servingLabel} onChangeText={edit('servingLabel', setServingLabel)} placeholder="e.g. 1 bar" maxLength={40} error={form.errors.servingLabel} />
        </View>
      </View>
      <Txt variant="label" tone="muted">The values below are per</Txt>
      <Segmented
        options={[{ label: 'Serving', value: 'serving' }, { label: `100 ${basis}`, value: '100' }]}
        value={per}
        onChange={(v) => {
          setPer(v);
          form.apply({});
        }}
      />
      {NUTRIENT_KEYS.map((k) => (
        <Field
          key={k}
          label={NUTRIENT_META[k].label}
          value={values[k]}
          onChangeText={(v) => {
            setValues((s) => ({ ...s, [k]: v }));
            form.clear(k);
          }}
          keyboardType="decimal-pad"
          suffix={NUTRIENT_META[k].unit}
          error={form.errors[k]}
        />
      ))}
      <Txt variant="label" tone="muted">Does the label list allergens?</Txt>
      <Segmented options={[{ label: 'Not listed', value: 'no' }, { label: 'Yes', value: 'yes' }]} value={allergenKnown} onChange={setAllergenKnown} />
      {allergenKnown === 'yes' ? <ChipMulti options={ALLERGENS.map((a) => ({ label: a.label, value: a.id }))} values={allergens} onChange={setAllergens} /> : null}
      <FormErrorSummary count={form.count} />
    </Screen>
  );
}
