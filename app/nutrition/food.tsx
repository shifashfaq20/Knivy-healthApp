import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { Banner, Button, Card, ChipSelect, Divider, EmptyState, Field, Screen, Txt } from '../../src/components/ui';
import { useRecord } from '../../src/hooks/useRecords';
import { repos } from '../../src/repositories';
import { providerLabel } from '../../src/services/nutrition';
import { useDraft } from '../../src/stores/draftStore';
import { useProfile } from '../../src/stores/profileStore';
import type { FoodItem, MealSlot } from '../../src/types/models';
import { confirmDelete, showError } from '../../src/utils/alerts';
import { todayKey } from '../../src/utils/date';
import { MEAL_SLOTS, NUTRIENT_KEYS, NUTRIENT_META, allergenLabel, allergyConflicts, conflictsWithDiet, formatNutrient, scaleNutrients } from '../../src/utils/nutrition';
import { parseNumber } from '../../src/utils/units';
import { timestampForDay } from '../../src/features/nutrition/dates';
import { numberError } from '../../src/utils/validation';

function leave(fromSearch: boolean) {
  if (fromSearch && router.canDismiss()) router.dismiss(2);
  else router.back();
}

export default function FoodDetail() {
  const params = useLocalSearchParams<{ slot?: MealSlot; date?: string; target?: 'log' | 'recipe' | 'photo'; entryId?: string; from?: string }>();
  const entry = useRecord(repos.foodEntries, params.entryId);
  const draftFood = useDraft((s) => s.food);
  const setPicked = useDraft((s) => s.setPickedIngredient);
  const diet = useProfile((s) => s.diet);
  const target = params.entryId ? 'log' : (params.target ?? 'log');
  const food: FoodItem | null = params.entryId ? (entry.data?.data.food ?? null) : draftFood;

  const [slot, setSlot] = useState<MealSlot>(params.slot ?? 'snack');
  const [gramsText, setGramsText] = useState('100');
  const [servingLabel, setServingLabel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [portionError, setPortionError] = useState<string | null>(null);

  useEffect(() => {
    if (params.entryId && entry.data) {
      setSlot(entry.data.data.slot);
      setGramsText(String(Math.round(entry.data.data.grams * 10) / 10));
      setServingLabel(entry.data.data.servingLabel ?? null);
    } else if (!params.entryId && draftFood) {
      const first = draftFood.servings[0];
      if (first) {
        setGramsText(String(Math.round(first.grams * 10) / 10));
        setServingLabel(first.label);
      }
    }
  }, [params.entryId, entry.data, draftFood]);

  const grams = parseNumber(gramsText);
  const portion = useMemo(() => (food && grams ? scaleNutrients(food.per100g, grams) : null), [food, grams]);

  if (!food) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Food' }} />
        <EmptyState icon="restaurant-outline" title="No food selected" body="Go back and choose a food." actionLabel="Go back" onAction={() => router.back()} />
      </Screen>
    );
  }

  const conflicts = allergyConflicts(food, diet.allergies);
  const dietIssue = conflictsWithDiet(food, diet.preferences);

  const save = async () => {
    const problem = numberError(gramsText, { label: 'a portion', required: true, positive: true, max: 5000, unit: food.basis });
    if (problem || !grams) return setPortionError(problem ?? 'Enter a portion.');
    if (target === 'recipe' || target === 'photo') {
      setPicked({ food, grams });
      leave(params.from === 'search');
      return;
    }
    setSaving(true);
    try {
      if (params.entryId && entry.data) {
        await repos.foodEntries.update(params.entryId, { ...entry.data.data, slot, grams, servingLabel });
        router.back();
      } else {
        await repos.foodEntries.create(
          { slot, food, grams, servingLabel, origin: food.provider === 'recipe' ? 'recipe' : food.provider === 'custom' ? 'custom' : 'search' },
          { recordedAt: timestampForDay(params.date || todayKey()), source: 'manual', sourceName: providerLabel(food.provider) },
        );
        leave(params.from === 'search');
      }
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  const saveToMyFoods = async () => {
    try {
      const existing = (await repos.customFoods.list({ limit: 500 })).some((r) => r.data.food.key === food.key);
      if (!existing) await repos.customFoods.create({ food });
      Alert.alert(existing ? 'Already saved' : 'Saved to my foods', existing ? 'It’s already in your foods.' : 'Find it under Mine when you search.');
    } catch (e) {
      showError(e);
    }
  };

  return (
    <Screen
      keyboard
      footer={
        <Button
          full
          loading={saving}
          label={params.entryId ? 'Save changes' : target === 'recipe' ? 'Add to recipe' : target === 'photo' ? 'Use this food' : 'Log food'}
          onPress={save}
        />
      }
    >
      <Stack.Screen options={{ title: params.entryId ? 'Edit entry' : 'Add food' }} />
      <View style={{ gap: 4 }}>
        <Txt variant="title">{food.name}</Txt>
        <Txt tone="muted">{[food.brand, providerLabel(food.provider)].filter(Boolean).join(', ')}</Txt>
      </View>

      {conflicts.length ? <Banner tone="warn" title="Allergen alert" body={`The source lists ${conflicts.map(allergenLabel).join(', ').toLowerCase()}, which you’ve marked as an allergy. Check the package.`} /> : null}
      {dietIssue ? <Banner tone="warn" body={`${dietIssue} according to the source’s ingredient analysis.`} /> : null}
      {food.allergens == null ? (
        <Txt variant="caption" tone="muted">
          This source has no allergen information for this food.
        </Txt>
      ) : food.allergens.length === 0 ? (
        <Txt variant="caption" tone="muted">
          No allergens listed by the source. That doesn’t guarantee there are none.
        </Txt>
      ) : null}

      {food.servings.length ? (
        <ChipSelect
          options={food.servings.map((s) => ({ label: s.label, value: s.label }))}
          value={servingLabel}
          onChange={(label) => {
            const s = food.servings.find((x) => x.label === label);
            if (s) {
              setServingLabel(s.label);
              setGramsText(String(Math.round(s.grams * 10) / 10));
            }
          }}
        />
      ) : null}
      <Field
        label="Portion"
        value={gramsText}
        onChangeText={(v) => {
          setGramsText(v);
          setServingLabel(null);
          setPortionError(null);
        }}
        keyboardType="decimal-pad"
        suffix={food.basis}
        error={portionError}
      />
      {target === 'log' ? <ChipSelect options={MEAL_SLOTS.map((s) => ({ label: s.label, value: s.id }))} value={slot} onChange={(v) => v && setSlot(v)} /> : null}

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Txt variant="label" tone="muted">
            Nutrient
          </Txt>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Txt variant="label" tone="muted" style={{ width: 90, textAlign: 'right' }}>
              per 100 {food.basis}
            </Txt>
            <Txt variant="label" tone="muted" style={{ width: 90, textAlign: 'right' }}>
              this portion
            </Txt>
          </View>
        </View>
        {NUTRIENT_KEYS.map((k, i) => (
          <View key={k}>
            {i > 0 ? <Divider /> : null}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
              <Txt>{NUTRIENT_META[k].label}</Txt>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <Txt tone={food.per100g[k] === null ? 'faint' : 'muted'} style={{ width: 90, textAlign: 'right' }}>
                  {food.per100g[k] === null ? 'n/a' : formatNutrient(k, food.per100g[k])}
                </Txt>
                <Txt variant="bodyMedium" tone={portion?.[k] === null ? 'faint' : 'ink'} style={{ width: 90, textAlign: 'right' }}>
                  {portion ? (portion[k] === null ? 'n/a' : formatNutrient(k, portion[k])) : 'n/a'}
                </Txt>
              </View>
            </View>
          </View>
        ))}
        <Txt variant="caption" tone="muted" style={{ marginTop: 8 }}>
          n/a means the source doesn’t provide this value.
        </Txt>
      </Card>

      {food.provider !== 'custom' && food.provider !== 'recipe' ? <Button label="Save to my foods" icon="bookmark-outline" variant="secondary" size="sm" onPress={saveToMyFoods} /> : null}
      {params.entryId && entry.data ? (
        <Button
          label="Delete entry"
          variant="danger"
          icon="trash-outline"
          onPress={() =>
            confirmDelete('this entry', async () => {
              await repos.foodEntries.remove(params.entryId!);
              router.back();
            })
          }
        />
      ) : null}
    </Screen>
  );
}
