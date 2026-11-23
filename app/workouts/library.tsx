import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, ChipSelect, EmptyState, Field, Screen, Segmented, Txt } from '../../src/components/ui';
import { CATEGORIES } from '../../src/features/workouts/library';
import { useExercises } from '../../src/features/workouts/useExercises';
import { repos } from '../../src/repositories';
import { useDraft } from '../../src/stores/draftStore';
import type { ExerciseCategory } from '../../src/types/models';
import { confirmDelete } from '../../src/utils/alerts';

export default function ExerciseLibrary() {
  const { pick } = useLocalSearchParams<{ pick?: 'builder' | 'session' }>();
  const exercises = useExercises();
  const setPicked = useDraft((s) => s.setPickedExercise);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<ExerciseCategory | null>(null);
  const [setting, setSetting] = useState<'all' | 'home' | 'gym'>('all');
  const [open, setOpen] = useState<string | null>(null);

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return exercises.filter(
      (e) =>
        (!category || e.category === category) &&
        (setting === 'all' || e.settings.includes(setting)) &&
        (!query || e.name.toLowerCase().includes(query) || e.muscles.some((m) => m.toLowerCase().includes(query))),
    );
  }, [exercises, q, category, setting]);

  return (
    <Screen keyboard>
      <Stack.Screen options={{ title: pick ? 'Add an exercise' : 'Exercise library' }} />
      <Field value={q} onChangeText={setQ} placeholder="Search by name or muscle" returnKeyType="search" />
      <ChipSelect scroll allowNone options={CATEGORIES.map((c) => ({ label: c.label, value: c.id }))} value={category} onChange={setCategory} />
      <Segmented
        options={[
          { label: 'All', value: 'all' },
          { label: 'Home', value: 'home' },
          { label: 'Gym', value: 'gym' },
        ]}
        value={setting}
        onChange={setSetting}
      />
      <Button label="Create a custom exercise" icon="add" variant="secondary" size="sm" onPress={() => router.push('/workouts/exercise')} />
      {list.length === 0 ? <EmptyState icon="search-outline" title="No exercises match" body="Try a different search or category." /> : null}
      {list.map((e) => {
        const expanded = open === e.id;
        return (
          <Card key={e.id} onPress={() => setOpen(expanded ? null : e.id)} padding={16}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="heading">{e.name}</Txt>
                <Txt variant="caption" tone="muted">
                  {CATEGORIES.find((c) => c.id === e.category)?.label}, {e.difficulty}, {e.muscles.join(', ')}
                </Txt>
              </View>
              {pick ? (
                <Button
                  size="sm"
                  label="Add"
                  onPress={() => {
                    setPicked({ exercise: e, for: pick });
                    router.back();
                  }}
                />
              ) : null}
            </View>
            {expanded ? (
              <View style={{ marginTop: 12, gap: 8 }}>
                <Txt variant="label" tone="muted">
                  Equipment: {e.equipment.join(', ')}
                </Txt>
                {e.instructions.map((s, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
                    <Txt variant="label" tone="muted" style={{ width: 16 }}>
                      {i + 1}
                    </Txt>
                    <Txt style={{ flex: 1 }}>{s}</Txt>
                  </View>
                ))}
                {e.custom ? (
                  <Button
                    size="sm"
                    variant="danger"
                    label="Delete custom exercise"
                    onPress={() => confirmDelete(e.name, () => repos.customExercises.remove(e.id.replace('custom:', '')))}
                  />
                ) : null}
              </View>
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}
