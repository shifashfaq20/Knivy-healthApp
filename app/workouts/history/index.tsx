import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Card, Divider, EmptyState, ListRow, Screen, Segmented, Txt } from '../../../src/components/ui';
import { computeBests } from '../../../src/features/workouts/records';
import { useRecords } from '../../../src/hooks/useRecords';
import { repos } from '../../../src/repositories';
import { useProfile } from '../../../src/stores/profileStore';
import { formatDate, formatDuration } from '../../../src/utils/date';
import { distance, weight } from '../../../src/utils/units';

export default function WorkoutHistory() {
  const [tab, setTab] = useState<'sessions' | 'records'>('sessions');
  const units = useProfile((s) => s.units);
  const sessions = useRecords(repos.workoutSessions, { limit: 1000 });
  const bests = useMemo(() => [...computeBests(sessions.data ?? []).values()].sort((a, b) => a.name.localeCompare(b.name)), [sessions.data]);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Workout history' }} />
      <Segmented options={[{ label: 'Sessions', value: 'sessions' }, { label: 'Personal bests', value: 'records' }]} value={tab} onChange={setTab} />
      {tab === 'sessions' ? (
        <Card padding={14}>
          {(sessions.data ?? []).length === 0 ? (
            <EmptyState compact icon="barbell-outline" title="No workouts recorded" body="Finished workouts appear here." />
          ) : (
            (sessions.data ?? []).map((s, i) => (
              <View key={s.id}>
                {i > 0 ? <Divider /> : null}
                <ListRow
                  title={s.data.name}
                  subtitle={`${formatDate(s.recordedAt, true)}, ${formatDuration(s.data.durationMin)}, ${s.data.exercises.reduce((n, e) => n + e.sets.length, 0)} sets`}
                  onPress={() => router.push({ pathname: '/workouts/history/[id]', params: { id: s.id } })}
                />
              </View>
            ))
          )}
        </Card>
      ) : (
        <Card padding={14}>
          {bests.length === 0 ? (
            <EmptyState compact icon="trophy-outline" title="No personal bests yet" body="Bests are calculated from the sets you complete." />
          ) : (
            bests.map((b, i) => (
              <View key={b.exerciseId}>
                {i > 0 ? <Divider /> : null}
                <ListRow
                  title={b.name}
                  subtitle={[
                    b.heaviest ? `Heaviest ${weight.format(b.heaviest.weightKg, units)}${b.heaviest.reps ? ` × ${b.heaviest.reps}` : ''} (${formatDate(b.heaviest.at, true)})` : null,
                    b.mostReps ? `Most reps ${b.mostReps.reps}` : null,
                    b.longestSec ? `Longest ${formatDuration(b.longestSec.seconds / 60)}` : null,
                    b.farthestKm ? `Farthest ${distance.format(b.farthestKm.km, units)}` : null,
                  ]
                    .filter(Boolean)
                    .join('\n')}
                  right={`${b.sessions}×`}
                />
              </View>
            ))
          )}
        </Card>
      )}
      <Txt variant="caption" tone="muted">
        Personal bests come only from completed sets you recorded.
      </Txt>
    </Screen>
  );
}
