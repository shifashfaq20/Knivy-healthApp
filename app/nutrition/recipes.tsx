import { Stack, router } from 'expo-router';
import { View } from 'react-native';
import { Button, Card, EmptyState, Screen, Txt } from '../../src/components/ui';
import { useRecords } from '../../src/hooks/useRecords';
import { repos } from '../../src/repositories';
import { useDraft } from '../../src/stores/draftStore';
import { useProfile } from '../../src/stores/profileStore';
import { allergenLabel, allergyConflicts, foodFromRecipe, sumPortions } from '../../src/utils/nutrition';

export default function Recipes() {
  const recipes = useRecords(repos.recipes, { limit: 500 });
  const allergies = useProfile((s) => s.diet.allergies);
  const setFood = useDraft((s) => s.setFood);
  const setTarget = useDraft((s) => s.setTarget);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Recipes' }} />
      <Button full label="New recipe" icon="add" onPress={() => router.push('/nutrition/recipe')} />
      {(recipes.data ?? []).length === 0 ? (
        <EmptyState icon="book-outline" title="No recipes yet" body="Build a recipe from real ingredients. Knivy totals the nutrition from each ingredient’s data." />
      ) : null}
      {(recipes.data ?? []).map((r) => {
        const totals = sumPortions(r.data.ingredients);
        const per = (v: number) => Math.round(v / Math.max(1, r.data.servings));
        const conflicts = [...new Set(r.data.ingredients.flatMap((i) => allergyConflicts(i.food, allergies)))];
        return (
          <Card key={r.id} onPress={() => router.push({ pathname: '/nutrition/recipe', params: { id: r.id } })} padding={16}>
            <View style={{ gap: 6 }}>
              <Txt variant="heading">{r.data.name}</Txt>
              <Txt variant="caption" tone="muted">
                {r.data.servings} serving{r.data.servings === 1 ? '' : 's'}, {r.data.ingredients.length} ingredients. Per serving: {per(totals.values.energyKcal)} kcal, {per(totals.values.proteinG)} g protein
                {totals.missing.energyKcal ? ` (incomplete: ${totals.missing.energyKcal} without energy data)` : ''}
              </Txt>
              {conflicts.length ? (
                <Txt variant="caption" tone="danger">
                  Contains {conflicts.map(allergenLabel).join(', ').toLowerCase()}
                </Txt>
              ) : null}
              <Button
                size="sm"
                variant="secondary"
                label="Log a serving"
                onPress={() => {
                  setFood(foodFromRecipe(r), null);
                  setTarget('log');
                  router.push({ pathname: '/nutrition/food', params: { target: 'log' } });
                }}
              />
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
