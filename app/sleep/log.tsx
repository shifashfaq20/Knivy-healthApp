import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, ChipSelect, DateTimeField, Field, Screen, SourceBadge, Txt } from '../../src/components/ui';
import { useRecord } from '../../src/hooks/useRecords';
import { repos } from '../../src/repositories';
import { confirmDelete, showError } from '../../src/utils/alerts';
import { formatDate, formatDuration, formatTime } from '../../src/utils/date';
import { LIMITS, check, futureError, useFormErrors } from '../../src/utils/validation';

function defaults() {
  const now = new Date();
  const seven = new Date();
  seven.setHours(7, 0, 0, 0);
  const end = seven < now ? seven : now;
  return { start: new Date(end.getTime() - 8 * 3_600_000), end };
}

type Key = 'start' | 'end' | 'note';

export default function LogSleep() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useRecord(repos.sleep, id);
  const init = defaults();
  const [start, setStart] = useState<Date>(init.start);
  const [end, setEnd] = useState<Date>(init.end);
  const [quality, setQuality] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const form = useFormErrors<Key>();

  useEffect(() => {
    const s = existing.data?.data;
    if (!s) return;
    setStart(new Date(s.start));
    setEnd(new Date(s.end));
    setQuality(s.quality ?? null);
    setNote(s.note ?? '');
  }, [existing.data]);

  const hours = (end.getTime() - start.getTime()) / 3_600_000;

  const save = async () => {
    let endError = futureError(end, 'Wake time');
    if (!endError && hours <= 0) endError = 'Wake time must be after the time you went to sleep.';
    else if (!endError && hours > 24) endError = 'A single sleep can’t be longer than 24 hours. Check the dates.';
    else if (!endError && hours < 5 / 60) endError = 'That’s under 5 minutes. Check the times.';
    let startError = futureError(start, 'Bedtime');
    setSaving(true);
    try {
      if (!startError && !endError) {
        const pad = 36 * 3_600_000;
        const nearby = await repos.sleep.list({ from: new Date(start.getTime() - pad).toISOString(), to: new Date(end.getTime() + pad).toISOString() });
        const clash = nearby.find((s) => s.id !== id && new Date(s.data.start) < end && new Date(s.data.end) > start);
        if (clash) {
          startError = `This overlaps a sleep you already logged: ${formatDate(clash.data.end)}, ${formatTime(clash.data.start)} to ${formatTime(clash.data.end)}. Edit that one instead, or change the times.`;
        }
      }
      if (!form.apply({ start: startError, end: endError, note: check.maxLength(LIMITS.note)(note) })) return;
      const prev = existing.data?.data;
      const data = { start: start.toISOString(), end: end.toISOString(), quality, note: note.trim() || undefined, stages: prev?.stages ?? null, restingHr: prev?.restingHr ?? null };
      if (id && existing.data) await repos.sleep.update(id, data, data.end);
      else await repos.sleep.create(data, { recordedAt: data.end });
      router.back();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen keyboard footer={<Button full label={id ? 'Save changes' : 'Save sleep'} onPress={save} loading={saving} />}>
      <Stack.Screen options={{ title: id ? 'Edit sleep' : 'Log sleep' }} />
      {existing.data && existing.data.source !== 'manual' ? <SourceBadge source={existing.data.source} name={existing.data.sourceName} /> : null}
      <DateTimeField
        label="Went to sleep"
        value={start}
        onChange={(d) => {
          setStart(d);
          form.clear('start');
          form.clear('end');
        }}
        maximumDate={new Date()}
        error={form.errors.start}
      />
      <DateTimeField
        label="Woke up"
        value={end}
        onChange={(d) => {
          setEnd(d);
          form.clear('end');
          form.clear('start');
        }}
        maximumDate={new Date()}
        error={form.errors.end}
      />
      <Txt variant="heading" tone={hours > 0 && hours <= 24 ? 'ink' : 'danger'}>
        {hours > 0 && hours <= 24 ? formatDuration(hours * 60) : 'Check the times'}
      </Txt>
      <Txt variant="label" tone="muted">
        How rested do you feel? (optional)
      </Txt>
      <ChipSelect allowNone options={[1, 2, 3, 4, 5].map((n) => ({ label: String(n), value: n }))} value={quality} onChange={setQuality} />
      <Field
        label="Notes"
        value={note}
        onChangeText={(v) => {
          setNote(v);
          form.clear('note');
        }}
        multiline
        maxLength={LIMITS.note}
        showCount
        placeholder="Anything that affected your sleep"
        error={form.errors.note}
      />
      <Txt variant="caption" tone="muted">
        Manual entries record duration only. Sleep stages need a compatible device connected through Apple Health or Health Connect.
      </Txt>
      {id && existing.data ? (
        <View>
          <Button
            label="Delete"
            variant="danger"
            icon="trash-outline"
            onPress={() =>
              confirmDelete('this sleep record', async () => {
                await repos.sleep.remove(id);
                router.back();
              })
            }
          />
        </View>
      ) : null}
    </Screen>
  );
}
