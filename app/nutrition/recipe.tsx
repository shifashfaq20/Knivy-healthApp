import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Divider, EmptyState, Field, FieldError, FormErrorSummary, IconButton, Screen, Stepper, Txt } from '../../src/components/ui';
import { useRecord, useRecords } from '../../src/hooks/useRecords';
import { repos } from '../../src/repositories';
import { useDraft } from '../../src/stores/draftStore';
import type { RecipeIngredient } from '../../src/types/models';
import { confirmDelete, showError } from '../../src/utils/alerts';
import { NUTRIENT_META, sumPortions } from '../../src/utils/nutrition';
import { parseNumber } from '../../src/utils/units';
import { LIMITS, check, numberError, useFormErrors, validate } from '../../src/utils/validation';

export default function RecipeEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useRecord(repos.recipes, id);
  const all = useRecords(repos.recipes, { limit: 500 });
  const picked = useDraft((s) => s.pickedIngredient);
  const setPicked = useDraft((s) => s.setPickedIngredient);
  const setTarget = useDraft((s) => s.setTarget);
  const [name, setName] = useState('');
  const [servings, setServings] = useState(2);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [gramsText, setGramsText] = useState<string[]>([]);
  const [instructions, setInstructions] = useState('');
  const form = useFormErrors<string>();

  useEffect(() => {
    const r = existing.data?.data;
    if (!r) return;
    setName(r.name);
    setServings(r.servings);
    setIngredients(r.ingredients);
    setGramsText(r.ingredients.map((i) => String(i.grams)));
    setInstructions(r.instructions ?? '');
  }, [existing.data]);

  useEffect(() => {
    if (!picked) return;
    setIngredients((xs) => [...xs, picked]);
    setGramsText((xs) => [...xs, String(Math.round(picked.grams))]);
    form.clear('ingredients');
    setPicked(null);
  }, [picked, setPicked, form.clear]);

  const current = ingredients.map((ing, i) => ({ ...ing, grams: parseNumber(gramsText[i] ?? '') ?? 0 }));
  const totals = sumPortions(current);
  const per = (v: number) => v / Math.max(1, servings);

  const save = async () => {
    const errors: Record<string, string | null | undefined> = {
      ...validate({ name, instructions }, { name: [check.required('a name for the recipe'), check.text(), check.maxLength(LIMITS.title)], instructions: [check.maxLength(2000)] }),
      ingredients: ingredients.length === 0 ? 'Add at least one ingredient.' : null,
    };
    if (!errors.name && (all.data ?? []).some((r) => r.id !== id && r.data.name.trim().toLowerCase() === name.trim().toLowerCase())) {
      errors.name = 'You already have a recipe with this name.';
    }
    ingredients.forEach((ing, i) => {
      errors[`ing-${i}`] = numberError(gramsText[i] ?? '', { label: 'an amount', required: true, positive: true, max: 5000, unit: ing.food.basis });
    });
    if (!form.apply(errors)) return;
    const data = { name: name.trim(), servings, ingredients: current, instructions: instructions.trim() || undefined };
    try {
      if (id && existing.data) await repos.recipes.update(id, data);
      else await repos.recipes.create(data);
      router.back();
    } catch (e) {
      showError(e);
    }
  };

  return (
    <Screen keyboard footer={<Button full label="Save recipe" onPress={save} />}>
      <Stack.Screen options={{ title: id ? 'Edit recipe' : 'New recipe' }} />
      <Field
        label="Name"
        value={name}
        onChangeText={(v) => {
          setName(v);
          form.clear('name');
        }}
        maxLength={LIMITS.title}
        error={form.errors.name}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Txt variant="label" tone="muted">
          Servings
        </Txt>
        <Stepper label="servings" value={servings} min={1} max={50} onChange={setServings} />
      </View>
      <Card padding={14}>
        {ingredients.length === 0 ? (
          <EmptyState compact icon="nutrition-outline" title="No ingredients" body="Add ingredients from a food database or your own foods." />
        ) : (
          ingredients.map((ing, i) => (
            <View key={`${ing.food.key}-${i}`}>
              {i > 0 ? <Divider /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 }}>
                <Txt style={{ flex: 1, marginTop: 14 }} numberOfLines={2}>
                  {ing.food.name}
                </Txt>
                <View style={{ width: 120 }}>
                  <Field
                    value={gramsText[i] ?? ''}
                    onChangeText={(v) => {
                      setGramsText((xs) => xs.map((x, j) => (j === i ? v : x)));
                      form.clear(`ing-${i}`);
                    }}
                    keyboardType="decimal-pad"
                    suffix={ing.food.basis}
                    error={form.errors[`ing-${i}`]}
                  />
                </View>
                <View style={{ marginTop: 9 }}>
                  <IconButton
                    icon="close"
                    tone="clear"
                    size={30}
                    label="Remove ingredient"
                    onPress={() => {
                      setIngredients((xs) => xs.filter((_, j) => j !== i));
                      setGramsText((xs) => xs.filter((_, j) => j !== i));
                      form.apply({});
                    }}
                  />
                </View>
              </View>
            </View>
          ))
        )}
      </Card>
      <FieldError message={form.errors.ingredients} />
      <Button
        label="Add ingredient"
        icon="add"
        variant="secondary"
        onPress={() => {
          setTarget('recipe');
          router.push({ pathname: '/nutrition/search', params: { target: 'recipe' } });
        }}
      />
      <Card tone="linen">
        <Txt variant="label" tone="muted">
          Per serving
        </Txt>
        <Txt variant="heading" style={{ marginTop: 4 }}>
          {Math.round(per(totals.values.energyKcal))} kcal
        </Txt>
        <Txt variant="caption" tone="muted">
          {(['proteinG', 'carbsG', 'fatG', 'fiberG'] as const).map((k) => `${NUTRIENT_META[k].label} ${per(totals.values[k]).toFixed(1)} g`).join(', ')}
        </Txt>
        {Object.values(totals.missing).some((n) => n > 0) ? (
          <Txt variant="caption" tone="muted" style={{ marginTop: 6 }}>
            Some ingredients don’t list every nutrient, so these totals are incomplete. When logged, missing nutrients show as not available.
          </Txt>
        ) : null}
      </Card>
      <Field
        label="Method (optional)"
        value={instructions}
        onChangeText={(v) => {
          setInstructions(v);
          form.clear('instructions');
        }}
        multiline
        maxLength={2000}
        showCount
        error={form.errors.instructions}
      />
      <FormErrorSummary count={form.count} />
      {id && existing.data ? (
        <Button
          label="Delete recipe"
          variant="danger"
          icon="trash-outline"
          onPress={() =>
            confirmDelete('this recipe', async () => {
              await repos.recipes.remove(id);
              router.back();
            })
          }
        />
      ) : null}
    </Screen>
  );
}
