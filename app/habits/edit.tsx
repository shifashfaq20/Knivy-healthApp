import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Button, Card, ChipSelect, DateTimeField, Field, Screen, ToggleRow, Txt, WeekdayPicker } from '../../src/components/ui';
import { HABIT_CATEGORIES, ROUTINES } from '../../src/features/habits';
import { useRecord, useRecords } from '../../src/hooks/useRecords';
import { repos } from '../../src/repositories';
import { cancelReminders, ensureNotificationPermission, scheduleReminder } from '../../src/services/notifications';
import type { Habit, HabitCategory } from '../../src/types/models';
import { confirmDelete, showError } from '../../src/utils/alerts';
import { hhmmToDate, toHHMM } from '../../src/utils/date';
import { LIMITS, check, useFormErrors, validate } from '../../src/utils/validation';

export default function EditHabit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useRecord(repos.habits, id);
  const all = useRecords(repos.habits, { limit: 500 });
  const [name, setName] = useState('');
  const [category, setCategory] = useState<HabitCategory>('health');
  const [routine, setRoutine] = useState<Habit['routine']>('anytime');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [remind, setRemind] = useState(false);
  const [time, setTime] = useState(() => hhmmToDate('08:00'));
  const [paused, setPaused] = useState(false);
  const [saving, setSaving] = useState(false);
  const form = useFormErrors<'name'>();

  useEffect(() => {
    const h = existing.data?.data;
    if (!h) return;
    setName(h.name);
    setCategory(h.category);
    setRoutine(h.routine);
    setWeekdays(h.weekdays);
    setRemind(!!h.reminderTime);
    if (h.reminderTime) setTime(hhmmToDate(h.reminderTime));
    setPaused(h.paused);
  }, [existing.data]);

  const save = async () => {
    const errors = validate({ name }, { name: [check.required('a name for the habit'), check.text(), check.maxLength(LIMITS.short)] });
    const clean = name.trim().toLowerCase();
    if (!errors.name && (all.data ?? []).some((h) => h.id !== id && h.data.name.trim().toLowerCase() === clean)) {
      errors.name = 'You already have a habit with this name.';
    }
    if (!form.apply(errors)) return;
    setSaving(true);
    try {
      await cancelReminders(existing.data?.data.notificationIds);
      let notificationIds: string[] = [];
      let reminderTime: string | null = remind ? toHHMM(time) : null;
      if (remind && !paused) {
        if (await ensureNotificationPermission()) {
          notificationIds = await scheduleReminder({ title: name.trim(), body: 'A reminder for your habit.', time: reminderTime!, weekdays });
        } else {
          reminderTime = null;
          Alert.alert('Notifications are off', 'The habit was saved without a reminder. Allow notifications for Knivy in Settings to add one.');
        }
      }
      const data: Habit = { name: name.trim(), category, routine, weekdays, reminderTime, notificationIds, paused };
      if (id && existing.data) await repos.habits.update(id, data);
      else await repos.habits.create(data);
      router.back();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen keyboard footer={<Button full label="Save habit" onPress={save} loading={saving} />}>
      <Stack.Screen options={{ title: id ? 'Edit habit' : 'New habit' }} />
      <Field
        label="Habit"
        value={name}
        onChangeText={(v) => {
          setName(v);
          form.clear('name');
        }}
        placeholder="e.g. Stretch for 5 minutes"
        autoFocus={!id}
        maxLength={LIMITS.short}
        error={form.errors.name}
      />
      <Txt variant="label" tone="muted">Type</Txt>
      <ChipSelect options={HABIT_CATEGORIES} value={category} onChange={(v) => v && setCategory(v)} />
      <Txt variant="label" tone="muted">Part of my</Txt>
      <ChipSelect options={ROUTINES} value={routine} onChange={(v) => v && setRoutine(v)} />
      <Txt variant="label" tone="muted">Days</Txt>
      <WeekdayPicker value={weekdays} onChange={setWeekdays} />
      <Txt variant="caption" tone="muted">
        {weekdays.length === 0 ? 'No days selected means every day.' : `${weekdays.length} day${weekdays.length === 1 ? '' : 's'} a week.`}
      </Txt>
      <Card>
        <ToggleRow label="Reminder" value={remind} onChange={setRemind} />
        {remind ? <DateTimeField label="Time" mode="time" value={time} onChange={setTime} /> : null}
        <ToggleRow label="Pause this habit" description="Paused habits keep their history but don’t appear on your checklist." value={paused} onChange={setPaused} />
      </Card>
      {id && existing.data ? (
        <Button
          label="Delete habit"
          variant="danger"
          icon="trash-outline"
          onPress={() =>
            confirmDelete('this habit', async () => {
              await cancelReminders(existing.data?.data.notificationIds);
              const logs = await repos.habitLogs.list({ limit: 20000 });
              for (const l of logs.filter((x) => x.data.habitId === id)) await repos.habitLogs.remove(l.id);
              await repos.habits.remove(id);
              router.back();
            }, 'Its completion history is deleted too.')
          }
        />
      ) : null}
    </Screen>
  );
}
