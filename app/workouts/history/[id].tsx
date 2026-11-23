import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Alert, View } from 'react-native';
import { Button, Card, EmptyState, LoadingState, Screen, SourceBadge, Txt } from '../../../src/components/ui';
import { useRecord } from '../../../src/hooks/useRecords';
import { repos } from '../../../src/repositories';
import { useProfile } from '../../../src/stores/profileStore';
import { useWorkoutSession } from '../../../src/stores/sessionStore';
import { confirmDelete } from '../../../src/utils/alerts';
import { formatDateTime, formatDuration } from '../../../src/utils/date';
import { distance, weight } from '../../../src/utils/units';

export default function SessionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const rec = useRecord(repos.workoutSessions, id);
  const units = useProfile((s) => s.units);
  const active = useWorkoutSession((s) => s.active);

  if (rec.isLoading) return <LoadingState />;
  const s = rec.data;
  if (!s) {
    return (
      <Screen>
        <EmptyState icon="barbell-outline" title="Workout not found" body="It may have been deleted." />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: s.data.name }} />
      <View style={{ gap: 6 }}>
        <Txt tone="muted">
          {formatDateTime(s.data.startedAt)}, {formatDuration(s.data.durationMin)}
        </Txt>
        <SourceBadge source={s.source} name={s.sourceName} />
      </View>
      {s.data.exercises.map((e, i) => (
        <Card key={i} padding={16}>
          <Txt variant="heading">{e.name}</Txt>
          <View style={{ gap: 4, marginTop: 8 }}>
            {e.sets.map((set, j) => (
              <Txt key={j} tone="muted">
                Set {j + 1}:{' '}
                {[
                  set.reps ? `${set.reps} reps` : null,
                  set.weightKg ? weight.format(set.weightKg, units) : null,
                  set.distanceKm ? distance.format(set.distanceKm, units) : null,
                  set.durationSec ? formatDuration(set.durationSec / 60) : null,
                ]
                  .filter(Boolean)
                  .join(', ') || 'completed'}
              </Txt>
            ))}
          </View>
        </Card>
      ))}
      {s.data.notes ? (
        <Card tone="linen">
          <Txt>{s.data.notes}</Txt>
        </Card>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button
          label="Edit"
          icon="create-outline"
          variant="secondary"
          onPress={() => {
            if (active) {
              Alert.alert('Finish your current workout first', 'You can only edit one workout at a time.');
              return;
            }
            router.push({ pathname: '/workouts/session', params: { sessionId: s.id } });
          }}
        />
        <Button
          label="Delete"
          icon="trash-outline"
          variant="danger"
          onPress={() =>
            confirmDelete('this workout', async () => {
              await repos.workoutSessions.remove(s.id);
              router.back();
            })
          }
        />
      </View>
    </Screen>
  );
}
