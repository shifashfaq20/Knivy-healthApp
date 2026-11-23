import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { Button, Card, ChipSelect, Divider, Field, IconButton, Screen, Segmented, Txt } from '../../src/components/ui';
import { useRecords } from '../../src/hooks/useRecords';
import { repos } from '../../src/repositories';
import { useDraft } from '../../src/stores/draftStore';
import { useProfile } from '../../src/stores/profileStore';
import { colors } from '../../src/theme/tokens';
import type { MealSlot } from '../../src/types/models';
import { confirmDelete, showError } from '../../src/utils/alerts';
import { addDaysKey, keysBetween, keysRange, parseDateKey, relativeDay, todayKey, weekdayOf } from '../../src/utils/date';
import { MEAL_SLOTS, allergenLabel, allergyConflicts, foodFromRecipe, sumPortions } from '../../src/utils/nutrition';
import { timestampForDay } from '../../src/features/nutrition/dates';
import { LIMITS } from '../../src/utils/validation';

function weekStart(key: string) {
  return addDaysKey(key, -((weekdayOf(key) + 6) % 7)); // Monday
}

export default function MealPlanner() {
  const [view, setView] = useState<'day' | 'week'>('week');
  const [anchor, setAnchor] = useState(todayKey());
  const days = view === 'week' ? keysBetween(weekStart(anchor), addDaysKey(weekStart(anchor), 6)) : [anchor];
  const plans = useRecords(repos.mealPlans, keysRange(days[0], days[days.length - 1]));
  const recipes = useRecords(repos.recipes, { limit: 500 });
  const allergies = useProfile((s) => s.diet.allergies);
  const setFood = useDraft((s) => s.setFood);
  const setTarget = useDraft((s) => s.setTarget);
  const [adding, setAdding] = useState<{ date: string; slot: MealSlot } | null>(null);
  const [freeText, setFreeText] = useState('');

  const recipeById = useMemo(() => new Map((recipes.data ?? []).map((r) => [r.id, r])), [recipes.data]);

  const addPlan = async (name: string, recipeId: string | null) => {
    if (!adding) return;
    try {
      await repos.mealPlans.create({ date: adding.date, slot: adding.slot, name, recipeId, servings: recipeId ? 1 : null }, { recordedAt: timestampForDay(adding.date) });
      setAdding(null);
      setFreeText('');
    } catch (e) {
      showError(e);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Meal plan' }} />
      <Segmented options={[{ label: 'Week', value: 'week' }, { label: 'Day', value: 'day' }]} value={view} onChange={setView} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon="chevron-back" label="Previous" onPress={() => setAnchor((a) => addDaysKey(a, view === 'week' ? -7 : -1))} />
        <Txt variant="heading">{view === 'week' ? `Week of ${parseDateKey(days[0]).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : relativeDay(anchor)}</Txt>
        <IconButton icon="chevron-forward" label="Next" onPress={() => setAnchor((a) => addDaysKey(a, view === 'week' ? 7 : 1))} />
      </View>

      {days.map((d) => {
        const dayPlans = (plans.data ?? []).filter((p) => p.data.date === d);
        return (
          <Card key={d} padding={16}>
            <Txt variant="subtitle">{relativeDay(d)}</Txt>
            {MEAL_SLOTS.map((slot) => {
              const items = dayPlans.filter((p) => p.data.slot === slot.id);
              return (
                <View key={slot.id} style={{ marginTop: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Txt variant="label" tone="muted" style={{ flex: 1 }}>
                      {slot.label}
                    </Txt>
                    <Pressable onPress={() => setAdding({ date: d, slot: slot.id })} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Plan ${slot.label}`}>
                      <Txt variant="label" tone="moss">
                        Add
                      </Txt>
                    </Pressable>
                  </View>
                  {items.map((p) => {
                    const recipe = p.data.recipeId ? recipeById.get(p.data.recipeId) : undefined;
                    const totals = recipe ? sumPortions(recipe.data.ingredients) : null;
                    const conflicts = recipe ? [...new Set(recipe.data.ingredients.flatMap((i) => allergyConflicts(i.food, allergies)))] : [];
                    return (
                      <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
                        <View style={{ flex: 1 }}>
                          <Txt>{p.data.name}</Txt>
                          <Txt variant="caption" tone={conflicts.length ? 'danger' : 'muted'}>
                            {conflicts.length
                              ? `Contains ${conflicts.map(allergenLabel).join(', ').toLowerCase()}`
                              : totals && recipe
                                ? `${Math.round(totals.values.energyKcal / Math.max(1, recipe.data.servings))} kcal per serving`
                                : 'No nutrition data'}
                          </Txt>
                        </View>
                        <Button
                          size="sm"
                          variant="secondary"
                          label={recipe ? 'Log' : 'Find'}
                          onPress={() => {
                            if (recipe) {
                              setFood(foodFromRecipe(recipe), p.data.slot);
                              setTarget('log');
                              router.push({ pathname: '/nutrition/food', params: { slot: p.data.slot, date: d, target: 'log' } });
                            } else {
                              router.push({ pathname: '/nutrition/search', params: { slot: p.data.slot, date: d, q: p.data.name } });
                            }
                          }}
                        />
                        <IconButton icon="close" tone="clear" size={30} label="Remove from plan" onPress={() => confirmDelete('this plan item', () => repos.mealPlans.remove(p.id))} />
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </Card>
        );
      })}

      <Modal visible={!!adding} transparent animationType="slide" onRequestClose={() => setAdding(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(43,39,34,0.25)' }} onPress={() => setAdding(null)} />
        <View style={{ backgroundColor: colors.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 40, gap: 12, maxHeight: '75%' }}>
          <Txt variant="subtitle">Plan a meal</Txt>
          {adding ? (
            <ChipSelect options={MEAL_SLOTS.map((s) => ({ label: s.label, value: s.id }))} value={adding.slot} onChange={(v) => v && setAdding({ ...adding, slot: v })} />
          ) : null}
          <Txt variant="label" tone="muted">
            From your recipes
          </Txt>
          <ScrollView style={{ maxHeight: 220 }}>
            {(recipes.data ?? []).length === 0 ? (
              <Txt tone="muted">No recipes yet. Create one in Recipes.</Txt>
            ) : (
              (recipes.data ?? []).map((r, i) => (
                <View key={r.id}>
                  {i > 0 ? <Divider /> : null}
                  <Pressable onPress={() => void addPlan(r.data.name, r.id)} style={{ paddingVertical: 12 }} accessibilityRole="button">
                    <Txt>{r.data.name}</Txt>
                  </Pressable>
                </View>
              ))
            )}
          </ScrollView>
          <Field label="Or write a meal idea" value={freeText} onChangeText={setFreeText} placeholder="e.g. Lentil soup" maxLength={LIMITS.title} />
          <Button full label="Add to plan" disabled={!freeText.trim()} onPress={() => void addPlan(freeText.trim(), null)} />
        </View>
      </Modal>
    </Screen>
  );
}
