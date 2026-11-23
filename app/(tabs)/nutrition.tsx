import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Banner, Button, Card, Divider, Icon, IconButton, PageHeader, ProgressBar, Ring, Screen, Txt, type IconName, Touchable } from '../../src/components/ui';
import { useRecords } from '../../src/hooks/useRecords';
import { repos } from '../../src/repositories';
import { usdaConfigured } from '../../src/services/nutrition';
import { useProfile } from '../../src/stores/profileStore';
import { colors } from '../../src/theme/tokens';
import { addDaysKey, dayRange, relativeDay, todayKey } from '../../src/utils/date';
import { MEAL_SLOTS, NUTRIENT_KEYS, NUTRIENT_META, allergyConflicts, scaleNutrients, sumPortions } from '../../src/utils/nutrition';

export default function NutritionTab() {
  const [day, setDay] = useState(todayKey());
  const goals = useProfile((s) => s.goals);
  const allergies = useProfile((s) => s.diet.allergies);
  const entries = useRecords(repos.foodEntries, dayRange(day), true);
  const [showAll, setShowAll] = useState(false);
  const list = entries.data ?? [];
  const totals = useMemo(() => sumPortions(list.map((e) => e.data)), [list]);
  const isToday = day === todayKey();

  const tools: { label: string; icon: IconName; onPress: () => void }[] = [
    { label: 'Scan barcode', icon: 'barcode-outline', onPress: () => router.push({ pathname: '/nutrition/barcode', params: { slot: 'snack', date: day } }) },
    { label: 'Meal photo', icon: 'camera-outline', onPress: () => router.push({ pathname: '/nutrition/scanner', params: { date: day } }) },
    { label: 'Recipes', icon: 'book-outline', onPress: () => router.push('/nutrition/recipes') },
    { label: 'Meal plan', icon: 'calendar-outline', onPress: () => router.push('/nutrition/planner') },
    { label: 'My foods', icon: 'bookmark-outline', onPress: () => router.push({ pathname: '/nutrition/search', params: { slot: 'snack', date: day, source: 'mine' } }) },
    { label: 'Goals', icon: 'flag-outline', onPress: () => router.push('/profile/goals') },
  ];

  return (
    <Screen tab>
      <PageHeader
        title="Nutrition"
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <IconButton icon="chevron-back" label="Previous day" size={34} onPress={() => setDay((d) => addDaysKey(d, -1))} />
            <Txt variant="label" style={{ minWidth: 70, textAlign: 'center' }}>
              {relativeDay(day)}
            </Txt>
            <IconButton icon="chevron-forward" label="Next day" size={34} onPress={() => setDay((d) => (d < todayKey() ? addDaysKey(d, 1) : d))} />
          </View>
        }
      />

      <Card hero>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <Ring value={totals.values.energyKcal} max={goals.calories} size={96} stroke={9}>
            <Txt variant="heading">{Math.round(totals.values.energyKcal)}</Txt>
            <Txt variant="caption" tone="muted">
              kcal
            </Txt>
          </Ring>
          <View style={{ flex: 1, gap: 10 }}>
            {(['proteinG', 'carbsG', 'fatG'] as const).map((k) => {
              const goal = k === 'proteinG' ? goals.proteinG : k === 'carbsG' ? goals.carbsG : goals.fatG;
              return (
                <View key={k} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Txt variant="caption" tone="muted">
                      {NUTRIENT_META[k].label}
                    </Txt>
                    <Txt variant="caption">
                      {Math.round(totals.values[k])}
                      {goal ? ` / ${goal}` : ''} g
                    </Txt>
                  </View>
                  <ProgressBar value={totals.values[k]} max={goal ?? Math.max(1, totals.values[k])} height={5} color={colors.ink} />
                </View>
              );
            })}
          </View>
        </View>
        {goals.calories ? (
          <Txt variant="caption" tone="muted" style={{ marginTop: 12 }}>
            {totals.values.energyKcal <= goals.calories
              ? `${Math.round(goals.calories - totals.values.energyKcal)} kcal left of your ${goals.calories} kcal goal.`
              : `${Math.round(totals.values.energyKcal - goals.calories)} kcal over your ${goals.calories} kcal goal.`}
          </Txt>
        ) : null}
        {totals.missing.energyKcal > 0 ? (
          <Txt variant="caption" tone="muted" style={{ marginTop: 4 }}>
            {totals.missing.energyKcal} item{totals.missing.energyKcal > 1 ? 's' : ''} without an energy value, so the total is incomplete.
          </Txt>
        ) : null}
        <Touchable onPress={() => setShowAll((v) => !v)} style={{ marginTop: 12 }} accessibilityRole="button">
          <Txt variant="label" tone="moss">
            {showAll ? 'Hide other nutrients' : 'Show other nutrients'}
          </Txt>
        </Touchable>
        {showAll ? (
          <View style={{ marginTop: 8, gap: 6 }}>
            {NUTRIENT_KEYS.filter((k) => !['energyKcal', 'proteinG', 'carbsG', 'fatG'].includes(k)).map((k) => (
              <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Txt tone="muted">{NUTRIENT_META[k].label}</Txt>
                <Txt>
                  {totals.count === totals.missing[k] ? 'Not available' : `${totals.values[k].toFixed(NUTRIENT_META[k].digits)} ${NUTRIENT_META[k].unit}`}
                  {totals.missing[k] > 0 && totals.count !== totals.missing[k] ? ` (${totals.missing[k]} missing)` : ''}
                </Txt>
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      {entries.isSuccess && list.length === 0 ? (
        <Card tone="linen">
          <Txt variant="heading" center>
            {isToday ? 'Nothing logged today yet' : 'Nothing logged on this day'}
          </Txt>
          <Txt tone="muted" center style={{ marginTop: 4 }}>
            Tap + on a meal to search a food database, scan a barcode or pick one of your own foods.
          </Txt>
        </Card>
      ) : null}

      {MEAL_SLOTS.map((slot) => {
        const items = list.filter((e) => e.data.slot === slot.id);
        const sub = sumPortions(items.map((e) => e.data));
        return (
          <Card key={slot.id} padding={16}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Txt variant="subtitle">{slot.label}</Txt>
                <Txt variant="caption" tone="muted">
                  {items.length ? `${Math.round(sub.values.energyKcal)} kcal` : 'Nothing logged'}
                </Txt>
              </View>
              <IconButton icon="add" label={`Add to ${slot.label}`} onPress={() => router.push({ pathname: '/nutrition/search', params: { slot: slot.id, date: day } })} />
            </View>
            {items.length ? <View style={{ height: 8 }} /> : null}
            {items.map((e, i) => {
              const n = scaleNutrients(e.data.food.per100g, e.data.grams);
              const conflicts = allergyConflicts(e.data.food, allergies);
              return (
                <View key={e.id}>
                  {i > 0 ? <Divider /> : null}
                  <Touchable
                    onPress={() => router.push({ pathname: '/nutrition/food', params: { entryId: e.id } })}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 }}
                    accessibilityRole="button"
                  >
                    <View style={{ flex: 1 }}>
                      <Txt variant="bodyMedium" numberOfLines={1}>
                        {e.data.food.name}
                      </Txt>
                      <Txt variant="caption" tone="muted">
                        {Math.round(e.data.grams)} {e.data.food.basis}
                        {e.data.food.brand ? `, ${e.data.food.brand}` : ''}
                        {e.data.origin === 'photo' ? ', from photo' : ''}
                      </Txt>
                    </View>
                    {conflicts.length ? <Icon name="alert-circle-outline" size={16} color={colors.danger} /> : null}
                    <Txt variant="label" tone={n.energyKcal === null ? 'faint' : 'ink'}>
                      {n.energyKcal === null ? 'kcal n/a' : `${Math.round(n.energyKcal)} kcal`}
                    </Txt>
                  </Touchable>
                </View>
              );
            })}
          </Card>
        );
      })}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {tools.map((t) => (
          <Touchable
            key={t.label}
            onPress={t.onPress}
            accessibilityRole="button"
            style={({ pressed }) => ({ width: '31.5%', padding: 14, gap: 8, borderRadius: 16, backgroundColor: colors.linen, opacity: pressed ? 0.7 : 1 })}
          >
            <Icon name={t.icon} size={20} />
            <Txt variant="label">{t.label}</Txt>
          </Touchable>
        ))}
      </View>
      {!isToday ? <Button label="Back to today" variant="ghost" onPress={() => setDay(todayKey())} /> : null}
      <Banner
        body={`Nutrition values come from Open Food Facts${usdaConfigured ? ', USDA FoodData Central' : ''} and foods you create. Missing values are shown as missing, never estimated.`}
      />
    </Screen>
  );
}
