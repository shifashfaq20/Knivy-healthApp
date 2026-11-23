import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Banner, Button, Card, ChipMulti, ChipSelect, Field, Screen, SectionHeader, Txt } from '../../src/components/ui';
import { useRecords } from '../../src/hooks/useRecords';
import { repos } from '../../src/repositories';
import { useProfile } from '../../src/stores/profileStore';
import type { Flow, Period, Rec } from '../../src/types/models';
import { confirmDelete, showError } from '../../src/utils/alerts';
import { CYCLE_MOODS, CYCLE_SYMPTOMS, FLOWS, MUCUS_TYPES, sortPeriods } from '../../src/utils/cycle';
import { addDaysKey, daysBetweenKeys, formatDateLong, parseDateKey, todayKey } from '../../src/utils/date';
import { num, parseNumber, temperature } from '../../src/utils/units';
import { LIMITS, numberError } from '../../src/utils/validation';

export default function CycleDayLog() {
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const date = dateParam && dateParam <= todayKey() ? dateParam : todayKey();
  const units = useProfile((s) => s.units);
  const periods = useRecords(repos.periods, { limit: 500 });
  const logs = useRecords(repos.cycleLogs, { limit: 2000 });

  const sorted = useMemo(() => sortPeriods(periods.data ?? []), [periods.data]);
  const containing = sorted.find((p) => p.data.startDate <= date && (p.data.endDate ? p.data.endDate >= date : true));
  const recentlyEnded = !containing
    ? [...sorted].reverse().find((p) => p.data.endDate && p.data.endDate < date && daysBetweenKeys(p.data.endDate, date) <= 3)
    : undefined;
  const existingLog = (logs.data ?? []).find((l) => l.data.date === date);

  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [mood, setMood] = useState<string | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [mucus, setMucus] = useState<string | null>(null);
  const [bbt, setBbt] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const l = existingLog?.data;
    if (!l) return;
    setSymptoms(l.symptoms);
    setMood(l.mood ?? null);
    setEnergy(l.energy ?? null);
    setMucus(l.mucus ?? null);
    setBbt(l.bbtC ? num(temperature.toDisplay(l.bbtC, units), 2) : '');
    setNote(l.note ?? '');
  }, [existingLog?.id, existingLog?.data, units]);

  const updatePeriod = async (p: Rec<Period>, patch: Partial<Period>) => {
    try {
      await repos.periods.update(p.id, { ...p.data, ...patch }, parseDateKey(patch.startDate ?? p.data.startDate).toISOString());
    } catch (e) {
      showError(e);
    }
  };

  const startPeriod = async () => {
    const nextStart = sorted.find((p) => p.data.startDate > date);
    try {
      await repos.periods.create(
        { startDate: date, endDate: nextStart ? addDaysKey(date, 0) : null, flow: {} },
        { recordedAt: parseDateKey(date).toISOString() },
      );
    } catch (e) {
      showError(e);
    }
  };

  const setFlow = (p: Rec<Period>, flow: Flow | null) => {
    const next = { ...p.data.flow };
    if (flow) next[date] = flow;
    else delete next[date];
    void updatePeriod(p, { flow: next });
  };

  const saveLog = async () => {
    setError(null);
    const bbtProblem = numberError(bbt, {
      min: Math.ceil(temperature.toDisplay(34, units) * 10) / 10,
      max: Math.floor(temperature.toDisplay(40, units) * 10) / 10,
      unit: temperature.unit(units),
    });
    if (bbtProblem) return setError(bbtProblem);
    const t = parseNumber(bbt);
    const bbtC: number | null = t !== null ? temperature.fromDisplay(t, units) : null;
    const data = { date, symptoms, mood, energy, mucus, bbtC, note: note.trim() || undefined };
    try {
      if (existingLog) await repos.cycleLogs.update(existingLog.id, data);
      else await repos.cycleLogs.create(data, { recordedAt: parseDateKey(date).toISOString() });
      router.back();
    } catch (e) {
      showError(e);
    }
  };

  return (
    <Screen keyboard footer={<Button full label="Save day" onPress={saveLog} />}>
      <Stack.Screen options={{ title: 'Log a day' }} />
      <Txt variant="title">{formatDateLong(date)}</Txt>

      <Card tone="rose">
        {containing ? (
          <View style={{ gap: 10 }}>
            <Txt variant="heading">Period, day {daysBetweenKeys(containing.data.startDate, date) + 1}</Txt>
            <Txt variant="label" tone="muted">
              Flow on this day
            </Txt>
            <ChipSelect allowNone options={FLOWS.map((f) => ({ label: f.label, value: f.id }))} value={containing.data.flow[date] ?? null} onChange={(v) => setFlow(containing, v)} />
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {containing.data.endDate !== date ? <Button size="sm" variant="secondary" label="Period ended this day" onPress={() => void updatePeriod(containing, { endDate: date })} /> : null}
              {containing.data.endDate ? <Button size="sm" variant="ghost" label="Still ongoing" onPress={() => void updatePeriod(containing, { endDate: null })} /> : null}
              <Button
                size="sm"
                variant="danger"
                label="Delete this period"
                onPress={() => confirmDelete('this period', () => repos.periods.remove(containing.id), 'The days logged within it stay in your symptom history.')}
              />
            </View>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <Txt variant="heading">No period logged on this day</Txt>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Button size="sm" label="Period started this day" onPress={() => void startPeriod()} />
              {recentlyEnded ? <Button size="sm" variant="secondary" label="Extend last period to here" onPress={() => void updatePeriod(recentlyEnded, { endDate: date })} /> : null}
            </View>
          </View>
        )}
      </Card>

      <SectionHeader title="Symptoms" />
      <ChipMulti options={CYCLE_SYMPTOMS.map((s) => ({ label: s, value: s }))} values={symptoms} onChange={setSymptoms} />
      <SectionHeader title="Mood" />
      <ChipSelect allowNone options={CYCLE_MOODS.map((s) => ({ label: s, value: s }))} value={mood} onChange={setMood} />
      <SectionHeader title="Energy" />
      <ChipSelect allowNone options={[1, 2, 3, 4, 5].map((n) => ({ label: ['Very low', 'Low', 'Okay', 'Good', 'High'][n - 1], value: n }))} value={energy} onChange={setEnergy} />
      <SectionHeader title="Optional" />
      <Txt variant="label" tone="muted">
        Cervical mucus
      </Txt>
      <ChipSelect allowNone options={MUCUS_TYPES.map((s) => ({ label: s, value: s }))} value={mucus} onChange={setMucus} />
      <Field
        label="Basal body temperature"
        value={bbt}
        onChangeText={(v) => {
          setBbt(v);
          setError(null);
        }}
        keyboardType="decimal-pad"
        suffix={temperature.unit(units)}
        hint="Measured right after waking, before getting up."
        error={error}
      />
      <Field label="Notes" value={note} onChangeText={setNote} multiline maxLength={LIMITS.note} />
    </Screen>
  );
}
