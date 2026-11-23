import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { LineChart } from '../../src/components/charts/Charts';
import { Button, Card, Divider, EmptyState, IconButton, ListRow, Screen, Segmented, SourceBadge, Txt } from '../../src/components/ui';
import { MEASUREMENTS, formatMeasurement } from '../../src/features/health/definitions';
import { useRecords } from '../../src/hooks/useRecords';
import { repos } from '../../src/repositories';
import { useProfile } from '../../src/stores/profileStore';
import { colors } from '../../src/theme/tokens';
import type { MeasurementType } from '../../src/types/models';
import { confirmDelete } from '../../src/utils/alerts';
import { addDaysKey, formatDate, formatDateTime, keysRange, todayKey } from '../../src/utils/date';

type Range = '30' | '90' | '365';

export default function MeasurementHistory() {
  const params = useLocalSearchParams<{ type: string }>();
  const type = (params.type in MEASUREMENTS ? params.type : 'weight') as MeasurementType;
  const def = MEASUREMENTS[type];
  const units = useProfile((s) => s.units);
  const [range, setRange] = useState<Range>('90');
  const today = todayKey();
  const records = useRecords(repos.measurements, keysRange(addDaysKey(today, -(Number(range) - 1)), today));
  const items = useMemo(() => (records.data ?? []).filter((m) => m.data.type === type), [records.data, type]);
  const chron = [...items].reverse();

  return (
    <Screen>
      <Stack.Screen options={{ title: def.label }} />
      <Segmented
        options={[
          { label: '30 days', value: '30' },
          { label: '90 days', value: '90' },
          { label: '1 year', value: '365' },
        ]}
        value={range}
        onChange={setRange}
      />
      <Card>
        {type === 'blood_pressure' ? (
          <View style={{ gap: 8 }}>
            <Txt variant="caption" tone="muted">
              Systolic (dark) and diastolic (light)
            </Txt>
            <LineChart data={chron.map((m) => ({ label: formatDate(m.recordedAt), value: m.data.value }))} color={colors.ink} />
            <LineChart data={chron.map((m) => ({ label: formatDate(m.recordedAt), value: m.data.value2 ?? null }))} color={colors.taupe} height={110} />
          </View>
        ) : (
          <LineChart
            data={chron.map((m) => ({ label: formatDate(m.recordedAt), value: def.toDisplay(m.data.value, units) }))}
            format={(v) => v.toFixed(def.decimals)}
          />
        )}
        <Txt variant="caption" tone="muted" style={{ marginTop: 6 }}>
          One point per reading. Gaps between readings aren’t filled in.
        </Txt>
      </Card>
      <Button label={`Add ${def.label.toLowerCase()}`} icon="add" onPress={() => router.push({ pathname: '/health/add', params: { type } })} />
      <Card padding={14}>
        {items.length === 0 ? (
          <EmptyState compact icon={def.icon} title="No readings in this period" body={def.hint} />
        ) : (
          items.map((m, i) => (
            <View key={m.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                title={formatMeasurement(type, m.data.value, m.data.value2, units)}
                subtitle={[formatDateTime(m.recordedAt), m.data.note].filter(Boolean).join('\n')}
                chevron={false}
                right={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <SourceBadge source={m.source} />
                    <IconButton icon="trash-outline" tone="clear" size={32} label="Delete reading" onPress={() => confirmDelete('this reading', () => repos.measurements.remove(m.id))} />
                  </View>
                }
              />
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}
