import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { Banner, Button, Card, DateTimeField, Field, FieldError, FormErrorSummary, IconButton, ListRow, LockGate, Screen, ToggleRow, Txt } from '../../src/components/ui';
import { useRecord } from '../../src/hooks/useRecords';
import { repos } from '../../src/repositories';
import { cancelReminders, ensureNotificationPermission, scheduleReminder } from '../../src/services/notifications';
import type { Medication } from '../../src/types/models';
import { confirmDelete, showError } from '../../src/utils/alerts';
import { dateKey, formatHHMM, hhmmToDate, parseDateKey, toHHMM } from '../../src/utils/date';
import { LIMITS, check, useFormErrors, validate } from '../../src/utils/validation';

type Key = 'name' | 'dosage' | 'form' | 'frequency' | 'instructions' | 'prescriber' | 'end' | 'times';

export default function MedicationForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useRecord(repos.medications, id);
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [doseForm, setDoseForm] = useState('');
  const [frequency, setFrequency] = useState('');
  const [instructions, setInstructions] = useState('');
  const [prescriber, setPrescriber] = useState('');
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);
  const [times, setTimes] = useState<string[]>([]);
  const [newTime, setNewTime] = useState(() => hhmmToDate('08:00'));
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const form = useFormErrors<Key>();

  useEffect(() => {
    const m = existing.data?.data;
    if (!m) return;
    setName(m.name);
    setDosage(m.dosage ?? '');
    setDoseForm(m.form ?? '');
    setFrequency(m.frequency ?? '');
    setInstructions(m.instructions ?? '');
    setPrescriber(m.prescriber ?? '');
    setStart(m.startDate ? parseDateKey(m.startDate) : null);
    setEnd(m.endDate ? parseDateKey(m.endDate) : null);
    setTimes(m.reminderTimes);
    setActive(m.active);
  }, [existing.data]);

  const edit = (key: Key, setter: (v: string) => void) => (v: string) => {
    setter(v);
    form.clear(key);
  };

  const addTime = () => {
    const t = toHHMM(newTime);
    if (times.includes(t)) return form.set('times', `A reminder at ${formatHHMM(t)} is already set.`);
    if (times.length >= 12) return form.set('times', 'You can set up to 12 reminder times.');
    form.clear('times');
    setTimes((xs) => [...xs, t].sort());
  };

  const save = async () => {
    const errors = validate(
      { name, dosage, form: doseForm, frequency, instructions, prescriber },
      {
        name: [check.required('the medication name'), check.text(), check.maxLength(LIMITS.short)],
        dosage: [check.text(), check.maxLength(40)],
        form: [check.text(), check.maxLength(40)],
        frequency: [check.text(), check.maxLength(LIMITS.title)],
        instructions: [check.maxLength(LIMITS.note)],
        prescriber: [check.text(), check.maxLength(LIMITS.short)],
      },
    );
    if (!form.apply({ ...errors, end: start && end && end < start ? 'The end date is before the start date.' : null })) return;
    setSaving(true);
    try {
      await cancelReminders(existing.data?.data.notificationIds);
      const notificationIds: string[] = [];
      if (active && times.length) {
        if (await ensureNotificationPermission()) {
          for (const t of times) {
            notificationIds.push(
              ...(await scheduleReminder({
                title: `${name.trim()}${dosage.trim() ? `, ${dosage.trim()}` : ''}`,
                body: 'Medication reminder. Follow the instructions from your prescriber.',
                time: t,
                data: { kind: 'medication' },
              })),
            );
          }
        } else {
          Alert.alert('Notifications are off', 'Saved without reminders. Allow notifications for Knivy in Settings to get them.');
        }
      }
      const data: Medication = {
        name: name.trim(),
        dosage: dosage.trim() || undefined,
        form: doseForm.trim() || undefined,
        frequency: frequency.trim() || undefined,
        instructions: instructions.trim() || undefined,
        prescriber: prescriber.trim() || undefined,
        startDate: start ? dateKey(start) : null,
        endDate: end ? dateKey(end) : null,
        reminderTimes: times,
        notificationIds,
        active,
      };
      if (id && existing.data) await repos.medications.update(id, data);
      else await repos.medications.create(data);
      router.back();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <LockGate area="records">
      <Screen keyboard footer={<Button full label="Save medication" onPress={save} loading={saving} />}>
        <Stack.Screen options={{ title: id ? 'Medication' : 'Add medication' }} />
        <Banner body="Enter the details exactly as your prescriber or the package gives them. Knivy doesn’t check doses, suggest changes or warn about interactions." />
        <Field label="Name" value={name} onChangeText={edit('name', setName)} autoFocus={!id} maxLength={LIMITS.short} error={form.errors.name} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label="Dose" value={dosage} onChangeText={edit('dosage', setDosage)} placeholder="e.g. 500 mg" maxLength={40} error={form.errors.dosage} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Form" value={doseForm} onChangeText={edit('form', setDoseForm)} placeholder="e.g. tablet" maxLength={40} error={form.errors.form} />
          </View>
        </View>
        <Field label="How often" value={frequency} onChangeText={edit('frequency', setFrequency)} placeholder="e.g. twice a day with food" maxLength={LIMITS.title} error={form.errors.frequency} />
        <Field label="Instructions" value={instructions} onChangeText={edit('instructions', setInstructions)} multiline maxLength={LIMITS.note} showCount error={form.errors.instructions} />
        <Field label="Prescribed by" value={prescriber} onChangeText={edit('prescriber', setPrescriber)} maxLength={LIMITS.short} error={form.errors.prescriber} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <DateTimeField
              label="Started"
              mode="date"
              value={start}
              onChange={(d) => {
                setStart(d);
                form.clear('end');
              }}
              placeholder="Not set"
              onClear={() => setStart(null)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <DateTimeField
              label="Ends"
              mode="date"
              value={end}
              onChange={(d) => {
                setEnd(d);
                form.clear('end');
              }}
              minimumDate={start ?? undefined}
              placeholder="Not set"
              onClear={() => setEnd(null)}
              error={form.errors.end}
            />
          </View>
        </View>
        <Card>
          <Txt variant="heading">Reminders</Txt>
          {times.length === 0 ? (
            <Txt tone="muted" style={{ marginTop: 4 }}>
              No reminder times.
            </Txt>
          ) : (
            times.map((t) => (
              <ListRow
                key={t}
                title={formatHHMM(t)}
                chevron={false}
                right={<IconButton icon="close" tone="clear" size={30} label={`Remove ${t}`} onPress={() => setTimes((xs) => xs.filter((x) => x !== t))} />}
              />
            ))
          )}
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end', marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <DateTimeField
                label="Add a time"
                mode="time"
                value={newTime}
                onChange={(d) => {
                  setNewTime(d);
                  form.clear('times');
                }}
              />
            </View>
            <Button size="sm" variant="secondary" label="Add" onPress={addTime} />
          </View>
          <FieldError message={form.errors.times} />
        </Card>
        <Card>
          <ToggleRow label="Currently taking" description="Turn off to keep it as a past medication. Reminders stop." value={active} onChange={setActive} />
        </Card>
        <FormErrorSummary count={form.count} />
        {id && existing.data ? (
          <Button
            label="Delete medication"
            variant="danger"
            icon="trash-outline"
            onPress={() =>
              confirmDelete('this medication', async () => {
                await cancelReminders(existing.data?.data.notificationIds);
                await repos.medications.remove(id);
                router.back();
              })
            }
          />
        ) : null}
      </Screen>
    </LockGate>
  );
}
