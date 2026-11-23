import { Stack, router } from 'expo-router';
import { View } from 'react-native';
import { Banner, Button, Card, Divider, EmptyState, ListRow, Screen, SectionHeader, Txt } from '../../src/components/ui';
import { describeTarget } from '../../src/features/workouts/useExercises';
import { useRecords } from '../../src/hooks/useRecords';
import { repos } from '../../src/repositories';
import { useWorkoutSession } from '../../src/stores/sessionStore';
import { colors } from '../../src/theme/tokens';
import { WEEKDAYS_SHORT, todayKey, weekdayOf } from '../../src/utils/date';

export default function Workouts() {
  const templates = useRecords(repos.workoutTemplates);
  const active = useWorkoutSession((s) => s.active);
  const todayWd = weekdayOf(todayKey());

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Workouts' }} />
      {active ? (
        <Card tone="moss" onPress={() => router.push('/workouts/session')}>
          <Txt variant="heading">{active.editingId ? 'Editing a workout' : 'Workout in progress'}</Txt>
          <Txt tone="muted">{active.name}. Tap to continue.</Txt>
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button full label="Start empty" icon="play" onPress={() => router.push('/workouts/session')} disabled={!!active} />
        </View>
        <View style={{ flex: 1 }}>
          <Button full label="Build workout" icon="add" variant="secondary" onPress={() => router.push('/workouts/builder')} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button full label="Exercise library" variant="secondary" icon="library-outline" onPress={() => router.push('/workouts/library')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button full label="History" variant="secondary" icon="time-outline" onPress={() => router.push('/workouts/history')} />
        </View>
      </View>

      <SectionHeader title="Weekly schedule" />
      <Card padding={14}>
        {WEEKDAYS_SHORT.map((d, i) => {
          const items = (templates.data ?? []).filter((t) => t.data.weekdays.includes(i));
          return (
            <View key={d} style={{ flexDirection: 'row', paddingVertical: 8, gap: 12, alignItems: 'center' }}>
              <Txt variant="label" tone={i === todayWd ? 'ink' : 'muted'} style={{ width: 40 }}>
                {d}
              </Txt>
              <Txt style={{ flex: 1 }} tone={items.length ? 'ink' : 'faint'}>
                {items.length ? items.map((t) => t.data.name).join(', ') : 'Rest'}
              </Txt>
              {i === todayWd ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.moss }} /> : null}
            </View>
          );
        })}
      </Card>

      <SectionHeader title="Your workouts" />
      <Card padding={14}>
        {(templates.data ?? []).length === 0 ? (
          <EmptyState compact icon="barbell-outline" title="No saved workouts" body="Combine exercises from the library into a routine you can repeat." actionLabel="Build a workout" onAction={() => router.push('/workouts/builder')} />
        ) : (
          (templates.data ?? []).map((t, i) => (
            <View key={t.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                title={t.data.name}
                subtitle={t.data.items.map((it) => `${it.name} ${describeTarget(it)}`).join(', ') || 'No exercises'}
                onPress={() => router.push({ pathname: '/workouts/builder', params: { id: t.id } })}
                right={<Button size="sm" label="Start" disabled={!!active} onPress={() => router.push({ pathname: '/workouts/session', params: { templateId: t.id } })} />}
                chevron={false}
              />
            </View>
          ))
        )}
      </Card>
      <Banner body="Stop if you feel pain, dizziness or chest discomfort. If you have a health condition, check with a professional before starting a new routine." />
    </Screen>
  );
}
