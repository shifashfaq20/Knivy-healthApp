import { useQuery } from '@tanstack/react-query';
import { useNetworkState } from 'expo-network';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Banner, Button, Card, Divider, EmptyState, ErrorState, Field, Icon, LoadingState, Screen, Segmented, ToggleRow, Txt } from '../../src/components/ui';
import { useRecords } from '../../src/hooks/useRecords';
import { repos } from '../../src/repositories';
import { providerLabel, searchFoods, usdaConfigured, type FoodSource } from '../../src/services/nutrition';
import { useDraft } from '../../src/stores/draftStore';
import { useProfile } from '../../src/stores/profileStore';
import { colors } from '../../src/theme/tokens';
import type { FoodItem, MealSlot } from '../../src/types/models';
import { allergenLabel, allergyConflicts, conflictsWithDiet } from '../../src/utils/nutrition';

function useDebounced<T>(value: T, ms = 450) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function FoodSearch() {
  const params = useLocalSearchParams<{ slot?: MealSlot; date?: string; target?: 'log' | 'recipe' | 'photo'; source?: FoodSource; q?: string }>();
  const target = params.target ?? 'log';
  const [q, setQ] = useState(params.q ?? '');
  const [source, setSource] = useState<FoodSource>(params.source ?? 'all');
  const [hideConflicts, setHideConflicts] = useState(false);
  const query = useDebounced(q.trim());
  const net = useNetworkState();
  const offline = net.isConnected === false || net.isInternetReachable === false;
  const diet = useProfile((s) => s.diet);
  const setFood = useDraft((s) => s.setFood);
  const setTarget = useDraft((s) => s.setTarget);
  const recent = useRecords(repos.foodEntries, { limit: 60 });

  const enabled = source === 'mine' || query.length >= 2;
  const results = useQuery({
    queryKey: ['food-search', source, query],
    queryFn: () => searchFoods(query, source),
    enabled,
    staleTime: 5 * 60_000,
    retry: 0,
  });

  const recentFoods = useMemo(() => {
    const seen = new Set<string>();
    const out: FoodItem[] = [];
    for (const r of recent.data ?? []) {
      if (seen.has(r.data.food.key)) continue;
      seen.add(r.data.food.key);
      out.push(r.data.food);
    }
    return out.slice(0, 12);
  }, [recent.data]);

  const choose = (food: FoodItem) => {
    setFood(food, params.slot ?? null);
    setTarget(target);
    router.push({ pathname: '/nutrition/food', params: { slot: params.slot ?? 'snack', date: params.date ?? '', target, from: 'search' } });
  };

  const showRecent = source !== 'mine' && query.length < 2;
  const list = (showRecent ? recentFoods : results.data ?? []).filter(
    (f) => !hideConflicts || (allergyConflicts(f, diet.allergies).length === 0 && !conflictsWithDiet(f, diet.preferences)),
  );

  const sources = [
    { label: 'All', value: 'all' as const },
    { label: 'Open Food Facts', value: 'openfoodfacts' as const },
    ...(usdaConfigured ? [{ label: 'USDA', value: 'usda' as const }] : []),
    { label: 'Mine', value: 'mine' as const },
  ];

  return (
    <Screen keyboard>
      <Stack.Screen options={{ title: target === 'recipe' ? 'Add ingredient' : 'Find a food' }} />
      <Field value={q} onChangeText={setQ} placeholder="Search foods or brands" autoFocus returnKeyType="search" />
      <Segmented options={sources} value={source} onChange={setSource} />
      {diet.allergies.length || diet.preferences.length ? (
        <ToggleRow label="Hide foods that don’t fit my diet" description="Uses allergen and ingredient data from the source, when it has any." value={hideConflicts} onChange={setHideConflicts} />
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button size="sm" variant="secondary" icon="barcode-outline" label="Scan barcode" onPress={() => router.push({ pathname: '/nutrition/barcode', params: { slot: params.slot ?? 'snack', date: params.date ?? '', target, via: 'search' } })} />
        <Button size="sm" variant="secondary" icon="add" label="Create food" onPress={() => router.push('/nutrition/custom-food')} />
      </View>

      {offline && source !== 'mine' ? <Banner tone="warn" title="You’re offline" body="Food databases need a connection. Your own foods still work." icon="cloud-offline-outline" /> : null}

      {showRecent ? (
        <Txt variant="label" tone="muted">
          {recentFoods.length ? 'Recently logged' : 'Type at least two letters to search'}
        </Txt>
      ) : null}

      {!showRecent && results.isFetching ? <LoadingState label="Searching" /> : null}
      {!showRecent && results.isError ? (
        <ErrorState message="The food database didn’t respond. Check your connection, then try again." onRetry={() => void results.refetch()} />
      ) : null}
      {!showRecent && results.isSuccess && list.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title="No matches"
          body={source === 'mine' ? 'Foods you create appear here.' : 'Try another name, a brand, or scan the barcode. You can also create the food yourself.'}
          actionLabel="Create food"
          onAction={() => router.push('/nutrition/custom-food')}
        />
      ) : null}

      {list.length ? (
        <Card padding={14}>
          {list.map((f, i) => {
            const conflicts = allergyConflicts(f, diet.allergies);
            const dietIssue = conflictsWithDiet(f, diet.preferences);
            return (
              <View key={`${f.key}-${i}`}>
                {i > 0 ? <Divider /> : null}
                <Pressable onPress={() => choose(f)} style={{ paddingVertical: 12, gap: 4 }} accessibilityRole="button">
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Txt variant="bodyMedium" style={{ flex: 1 }} numberOfLines={2}>
                      {f.name}
                    </Txt>
                    <Txt variant="label" tone={f.per100g.energyKcal === null ? 'faint' : 'ink'}>
                      {f.per100g.energyKcal === null ? 'kcal n/a' : `${Math.round(f.per100g.energyKcal)} kcal`}
                    </Txt>
                  </View>
                  <Txt variant="caption" tone="muted">
                    {[f.brand, `per 100 ${f.basis}`, providerLabel(f.provider)].filter(Boolean).join(', ')}
                  </Txt>
                  {conflicts.length ? (
                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      <Icon name="alert-circle-outline" size={14} color={colors.danger} />
                      <Txt variant="caption" tone="danger">
                        Contains {conflicts.map(allergenLabel).join(', ').toLowerCase()}
                      </Txt>
                    </View>
                  ) : null}
                  {dietIssue ? (
                    <Txt variant="caption" tone="danger">
                      {dietIssue}, according to the source
                    </Txt>
                  ) : null}
                </Pressable>
              </View>
            );
          })}
        </Card>
      ) : null}
      <Txt variant="caption" tone="muted">
        Product data from Open Food Facts is crowd-sourced. Check the package when allergens matter.
      </Txt>
    </Screen>
  );
}
