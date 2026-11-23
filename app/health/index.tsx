import { Stack, router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { Banner, Button, Card, Icon, Screen, SourceBadge, Txt } from '../../src/components/ui';
import { MEASUREMENTS, VITAL_TYPES, bmi, bmiCategory, formatMeasurement } from '../../src/features/health/definitions';
import { useRecords } from '../../src/hooks/useRecords';
import { repos } from '../../src/repositories';
import { useProfile } from '../../src/stores/profileStore';
import { colors } from '../../src/theme/tokens';
import type { Measurement, MeasurementType, Rec } from '../../src/types/models';
import { showError } from '../../src/utils/alerts';
import { toCsv, shareTextFile } from '../../src/utils/csv';
import { formatDateTime, isoToKey, relativeDay } from '../../src/utils/date';

export default function HealthIndex() {
  const units = useProfile((s) => s.units);
  const profileHeight = useProfile((s) => s.heightCm);
  const all = useRecords(repos.measurements, { limit: 2000 });

  const latest = useMemo(() => {
    const map = new Map<MeasurementType, Rec<Measurement>>();
    for (const m of all.data ?? []) if (!map.has(m.data.type)) map.set(m.data.type, m);
    return map;
  }, [all.data]);

  const w = latest.get('weight')?.data.value;
  const h = latest.get('height')?.data.value ?? profileHeight ?? undefined;
  const bmiValue = w && h ? bmi(w, h) : null;

  const exportCsv = async () => {
    try {
      const rows = (all.data ?? [])
        .filter((m) => m.data.type !== 'steps')
        .map((m) => [m.recordedAt, MEASUREMENTS[m.data.type].label, m.data.value, m.data.value2 ?? '', m.source, m.sourceName ?? '', m.data.note ?? '']);
      await shareTextFile('knivy-health-readings.csv', toCsv(['recorded_at_utc', 'measurement', 'value', 'value2', 'source', 'source_name', 'note'], rows), 'text/csv');
    } catch (e) {
      showError(e, 'Couldn’t create the report');
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Health readings' }} />
      <Button full label="Add a reading" icon="add" onPress={() => router.push('/health/add')} />

      <View style={{ gap: 10 }}>
        {VITAL_TYPES.map((type) => {
          const def = MEASUREMENTS[type];
          const m = latest.get(type);
          return (
            <Card key={type} onPress={() => router.push({ pathname: '/health/[type]', params: { type } })} padding={16}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.linen, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={def.icon} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Txt variant="label" tone="muted">
                    {def.label}
                  </Txt>
                  {m ? (
                    <>
                      <Txt variant="heading">{formatMeasurement(type, m.data.value, m.data.value2, units)}</Txt>
                      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Txt variant="caption" tone="muted">
                          {relativeDay(isoToKey(m.recordedAt))}
                        </Txt>
                        <SourceBadge source={m.source} name={m.sourceName} />
                      </View>
                    </>
                  ) : (
                    <Txt tone="faint">No readings</Txt>
                  )}
                </View>
                <Icon name="chevron-forward" size={16} color={colors.taupe} />
              </View>
            </Card>
          );
        })}
      </View>

      <Card tone="linen">
        <View style={{ gap: 6 }}>
          <Txt variant="label" tone="muted">
            Body mass index
          </Txt>
          {bmiValue ? (
            <>
              <Txt variant="number">{bmiValue.toFixed(1)}</Txt>
              <Txt tone="muted">{bmiCategory(bmiValue)} for adults (WHO).</Txt>
              <Txt variant="caption" tone="muted">
                Calculated from your latest weight ({formatDateTime(latest.get('weight')!.recordedAt)}) and height. BMI doesn’t reflect muscle, body shape or age, and isn’t used for children.
              </Txt>
            </>
          ) : (
            <Txt tone="muted">Add a weight and a height to calculate BMI.</Txt>
          )}
        </View>
      </Card>

      <Banner body="Your phone alone can’t measure blood pressure, blood oxygen or body temperature. Enter readings from a dedicated device, or import them from Apple Health or Health Connect in a development build." />
      <Button label="Share readings as CSV" icon="share-outline" variant="secondary" onPress={exportCsv} disabled={!all.data?.length} />
    </Screen>
  );
}
