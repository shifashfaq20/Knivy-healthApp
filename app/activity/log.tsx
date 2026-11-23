import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, ChipSelect, DateTimeField, Field, FormErrorSummary, Screen, SourceBadge, Txt } from '../../src/components/ui';
import { useRecord, useRecords } from '../../src/hooks/useRecords';
import { repos } from '../../src/repositories';
import { useProfile } from '../../src/stores/profileStore';
import type { Activity, ActivityKind } from '../../src/types/models';
import { confirmDelete, showError } from '../../src/utils/alerts';
import { estimateEnergyKcal } from '../../src/utils/energy';
import { distance, num, parseNumber } from '../../src/utils/units';
import { LIMITS, check, futureError, useFormErrors, validate } from '../../src/utils/validation';

const KINDS: { label: string; value: ActivityKind }[] = [
  { label: 'Walk', value: 'walk' },
  { label: 'Run', value: 'run' },
  { label: 'Ride', value: 'cycle' },
  { label: 'Hike', value: 'hike' },
  { label: 'Swim', value: 'swim' },
  { label: 'Other', value: 'other' },
];
/** Speeds above these are almost certainly a typo in distance or duration. */
const MAX_KMH: Partial<Record<ActivityKind, number>> = { walk: 12, hike: 12, run: 30, swim: 10, cycle: 80 };

type Key = 'title' | 'start' | 'minutes' | 'dist' | 'energy' | 'note';

export default function LogActivity() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useRecord(repos.activities, id);
  const units = useProfile((s) => s.units);
  const measures = useRecords(repos.measurements, { limit: 200 });
  const latestWeight = measures.data?.find((m) => m.data.type === 'weight')?.data.value ?? null;

  const [kind, setKind] = useState<ActivityKind>('walk');
  const [title, setTitle] = useState('');
  const [start, setStart] = useState<Date>(new Date(Date.now() - 30 * 60_000));
  const [minutes, setMinutes] = useState('30');
  const [dist, setDist] = useState('');
  const [energy, setEnergy] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const form = useFormErrors<Key>();

  useEffect(() => {
    const a = existing.data?.data;
    if (!a) return;
    setKind(a.kind);
    setTitle(a.title ?? '');
    setStart(new Date(a.startedAt));
    setMinutes(String(Math.round(a.durationMin)));
    setDist(a.distanceKm ? num(distance.toDisplay(a.distanceKm, units), 2) : '');
    setEnergy(a.energySource === 'manual' && a.energyKcal ? String(Math.round(a.energyKcal)) : '');
    setNote(a.note ?? '');
  }, [existing.data, units]);

  const duration = parseNumber(minutes);
  const estimate = useMemo(() => (duration && duration > 0 ? estimateEnergyKcal(kind, duration, latestWeight) : null), [kind, duration, latestWeight]);
  const isDevice = existing.data?.source === 'device';
  const edit = (key: Key, setter: (v: string) => void) => (v: string) => {
    setter(v);
    form.clear(key);
  };

  const save = async () => {
    const errors = validate(
      { title, minutes, dist, energy, note },
      {
        title: [check.text(), check.maxLength(LIMITS.short)],
        minutes: [check.number({ label: 'how long it lasted', required: true, min: 1, max: 1440, integer: true, unit: 'min' })],
        dist: [check.number({ positive: true, max: Math.round(distance.toDisplay(1000, units)), unit: distance.unit(units) })],
        energy: [check.number({ min: 1, max: 10000, integer: true, unit: 'kcal' })],
        note: [check.maxLength(LIMITS.note)],
      },
    );
    const d = parseNumber(dist);
    let startError = futureError(start, 'The start time');
    if (!startError && !errors.minutes && duration && start.getTime() + duration * 60_000 > Date.now() + 60_000) {
      startError = 'This activity would end in the future. Move the start earlier or shorten the duration.';
    }
    const cap = MAX_KMH[kind];
    if (cap && !errors.dist && !errors.minutes && d && duration) {
      const kmh = distance.fromDisplay(d, units) / (duration / 60);
      if (kmh > cap) {
        const shown = distance.toDisplay(kmh, units);
        errors.dist = `That’s about ${Math.round(shown)} ${distance.unit(units)}/h, too fast for this activity. Check the distance and duration.`;
      }
    }
    if (!form.apply({ ...errors, start: startError })) return;

    const e = parseNumber(energy);
    const end = new Date(start.getTime() + duration! * 60_000);
    const prev = existing.data?.data;
    const data: Activity = {
      kind,
      title: title.trim() || undefined,
      startedAt: start.toISOString(),
      endedAt: end.toISOString(),
      durationMin: duration!,
      distanceKm: d !== null ? distance.fromDisplay(d, units) : null,
      energyKcal: e !== null ? e : prev?.energySource === 'device' ? prev.energyKcal : estimate,
      energySource: e !== null ? 'manual' : prev?.energySource === 'device' ? 'device' : estimate !== null ? 'estimated' : null,
      route: prev?.route,
      note: note.trim() || undefined,
    };
    setSaving(true);
    try {
      if (id && existing.data) await repos.activities.update(id, data, data.startedAt);
      else await repos.activities.create(data, { recordedAt: data.startedAt });
      router.back();
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen keyboard footer={<Button full label={id ? 'Save changes' : 'Save activity'} onPress={save} loading={saving} />}>
      <Stack.Screen options={{ title: id ? 'Edit activity' : 'Log activity' }} />
      {isDevice ? <SourceBadge source="device" name={existing.data?.sourceName} /> : null}
      <ChipSelect
        options={KINDS}
        value={kind}
        onChange={(v) => {
          if (!v) return;
          setKind(v);
          form.clear('dist');
        }}
      />
      <Field label="Name (optional)" value={title} onChangeText={edit('title', setTitle)} placeholder="Evening walk" maxLength={LIMITS.short} error={form.errors.title} />
      <DateTimeField
        label="Started"
        value={start}
        onChange={(d) => {
          setStart(d);
          form.clear('start');
        }}
        maximumDate={new Date()}
        error={form.errors.start}
      />
      <Field label="Duration" value={minutes} onChangeText={edit('minutes', setMinutes)} keyboardType="number-pad" suffix="min" error={form.errors.minutes} />
      <Field label="Distance (optional)" value={dist} onChangeText={edit('dist', setDist)} keyboardType="decimal-pad" suffix={distance.unit(units)} error={form.errors.dist} />
      <Field
        label="Energy (optional)"
        value={energy}
        onChangeText={edit('energy', setEnergy)}
        keyboardType="number-pad"
        suffix="kcal"
        error={form.errors.energy}
        hint={
          energy
            ? 'Saved as the value you entered.'
            : estimate !== null
              ? `If left blank, Knivy saves an estimate of about ${estimate} kcal, labelled as an estimate.`
              : latestWeight
                ? 'No estimate is available for this activity type.'
                : 'Add your weight in Health readings to get an estimate.'
        }
      />
      <Field label="Notes" value={note} onChangeText={edit('note', setNote)} multiline maxLength={LIMITS.note} showCount error={form.errors.note} />
      <FormErrorSummary count={form.count} />
      {id && existing.data ? (
        <View style={{ marginTop: 8 }}>
          <Button
            label="Delete activity"
            variant="danger"
            icon="trash-outline"
            onPress={() =>
              confirmDelete('this activity', async () => {
                await repos.activities.remove(id);
                router.back();
              })
            }
          />
        </View>
      ) : null}
      {!id ? (
        <Txt variant="caption" tone="muted">
          To record distance with GPS, use Record outdoors on the Activity tab.
        </Txt>
      ) : null}
    </Screen>
  );
}
