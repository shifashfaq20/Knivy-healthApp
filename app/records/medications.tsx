import { Stack, router } from 'expo-router';
import { View } from 'react-native';
import { Button, Card, Divider, EmptyState, ListRow, LockGate, Screen, SectionHeader, Txt } from '../../src/components/ui';
import { useRecords } from '../../src/hooks/useRecords';
import { repos } from '../../src/repositories';
import { dayRange, formatHHMM, formatTime, todayKey } from '../../src/utils/date';

export default function Medications() {
  const meds = useRecords(repos.medications, { limit: 500 });
  const logs = useRecords(repos.medicationLogs, dayRange(todayKey()));
  const active = (meds.data ?? []).filter((m) => m.data.active);
  const inactive = (meds.data ?? []).filter((m) => !m.data.active);

  const row = (m: (typeof active)[number], i: number) => (
    <View key={m.id}>
      {i > 0 ? <Divider /> : null}
      <ListRow
        title={m.data.name}
        subtitle={[m.data.dosage, m.data.frequency, m.data.reminderTimes.length ? `Reminders ${m.data.reminderTimes.map(formatHHMM).join(', ')}` : null].filter(Boolean).join('\n')}
        onPress={() => router.push({ pathname: '/records/medication', params: { id: m.id } })}
      />
    </View>
  );

  return (
    <LockGate area="records">
      <Screen>
        <Stack.Screen options={{ title: 'Medications' }} />
        <Button full label="Add medication" icon="add" onPress={() => router.push('/records/medication')} />
        <Card padding={14}>{active.length ? active.map(row) : <EmptyState compact icon="medkit-outline" title="No current medications" />}</Card>
        {(logs.data ?? []).length ? (
          <>
            <SectionHeader title="Taken today" />
            <Card padding={14}>
              {(logs.data ?? []).map((l) => {
                const med = (meds.data ?? []).find((m) => m.id === l.data.medicationId);
                return (
                  <Txt key={l.id} style={{ paddingVertical: 6 }}>
                    {med?.data.name ?? 'Medication'}
                    {l.data.scheduledTime ? ` (${formatHHMM(l.data.scheduledTime)} dose)` : ''}, marked at {formatTime(l.recordedAt)}
                  </Txt>
                );
              })}
            </Card>
          </>
        ) : null}
        {inactive.length ? (
          <>
            <SectionHeader title="Past medications" />
            <Card padding={14}>{inactive.map(row)}</Card>
          </>
        ) : null}
      </Screen>
    </LockGate>
  );
}
