import { Stack, router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Button, Card, Divider, EmptyState, ListRow, LockGate, Screen } from '../../src/components/ui';
import { RECORD_KINDS, recordKind } from '../../src/features/records/schemas';
import { useRecords } from '../../src/hooks/useRecords';

export default function RecordList() {
  const params = useLocalSearchParams<{ kind: string }>();
  const kind = recordKind(params.kind);
  const records = useRecords((kind ?? RECORD_KINDS[0]).repo, { limit: 1000 }, !!kind);
  if (!kind) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title="Unknown record type" />
      </Screen>
    );
  }
  return (
    <LockGate area="records">
      <Screen>
        <Stack.Screen options={{ title: kind.title }} />
        <Button full label={`Add ${kind.singular}`} icon="add" onPress={() => router.push({ pathname: '/records/edit', params: { kind: kind.id } })} />
        <Card padding={14}>
          {(records.data ?? []).length === 0 ? (
            <EmptyState compact icon={kind.icon} title={`No ${kind.title.toLowerCase()} recorded`} />
          ) : (
            (records.data ?? []).map((r, i) => (
              <View key={r.id}>
                {i > 0 ? <Divider /> : null}
                <ListRow title={kind.titleOf(r.data)} subtitle={kind.subtitleOf(r.data)} onPress={() => router.push({ pathname: '/records/edit', params: { kind: kind.id, id: r.id } })} />
              </View>
            ))
          )}
        </Card>
      </Screen>
    </LockGate>
  );
}
