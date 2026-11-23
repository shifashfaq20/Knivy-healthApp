import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { BarChart } from '../src/components/charts/Charts';
import { Banner, Button, Card, DateTimeField, Divider, EmptyState, Field, IconButton, ListRow, ProgressBar, Screen, SectionHeader, ToggleRow, Txt } from '../src/components/ui';
import { useRecords } from '../src/hooks/useRecords';
import { repos } from '../src/repositories';
import { cancelReminders, ensureNotificationPermission, scheduleReminder } from '../src/services/notifications';
import { useProfile } from '../src/stores/profileStore';
import { colors } from '../src/theme/tokens';
import { confirmDelete, showError } from '../src/utils/alerts';
import { WEEKDAYS_LETTER, dayRange, formatHHMM, formatTime, isoToKey, keysRange, lastNDays, todayKey, toHHMM, weekdayOf } from '../src/utils/date';
import { parseNumber, volume } from '../src/utils/units';
import { GOAL_RULES } from '../src/features/goals';
import { check, numberError, useFormErrors } from '../src/utils/validation';

export default function Hydration() {
  const units = useProfile((s) => s.units);
  const goal = useProfile((s) => s.goals.waterMl);
  const setGoals = useProfile((s) => s.setGoals);
  const hydration = useProfile((s) => s.hydration);
  const update = useProfile((s) => s.update);
  const today = todayKey();
  const entries = useRecords(repos.water, dayRange(today));
  const week = lastNDays(7);
  const weekEntries = useRecords(repos.water, keysRange(week[0], week[6]));
  const [custom, setCustom] = useState('');
  const [goalText, setGoalText] = useState(goal ? String(Math.round(volume.toDisplay(goal, units))) : '');
  const [newLabel, setNewLabel] = useState('');
  const [newSize, setNewSize] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [reminderTime, setReminderTime] = useState<Date>(() => {
    const d = new Date();
    d.setHours(10, 0, 0, 0);
    return d;
  });

  const form = useFormErrors<'custom' | 'edit' | 'goal' | 'containerLabel' | 'containerSize'>();
  const amountRule = { label: 'an amount', required: true, min: Math.ceil(volume.toDisplay(10, units)), max: Math.floor(volume.toDisplay(5000, units)), unit: volume.unit(units) };
  const total = (entries.data ?? []).reduce((s, e) => s + e.data.amountMl, 0);
  const byDay = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of weekEntries.data ?? []) {
      const k = isoToKey(e.recordedAt);
      m[k] = (m[k] ?? 0) + e.data.amountMl;
    }
    return m;
  }, [weekEntries.data]);

  const add = async (ml: number, label: string | null) => {
    if (!ml || ml <= 0 || ml > 5000) return Alert.alert('Check the amount', 'Enter an amount between 1 ml and 5 litres.');
    try {
      await repos.water.create({ amountMl: ml, container: label });
    } catch (e) {
      showError(e);
    }
  };

  const saveGoal = () => {
    if (!form.apply({ goal: numberError(goalText, GOAL_RULES.waterMl(units)) })) return;
    const v = parseNumber(goalText);
    setGoals({ waterMl: v ? Math.round(volume.fromDisplay(v, units)) : null });
  };

  const rescheduleReminders = async (times: string[], enabled: boolean) => {
    await cancelReminders(hydration.reminders.notificationIds);
    let ids: string[] = [];
    if (enabled && times.length) {
      const ok = await ensureNotificationPermission();
      if (!ok) {
        Alert.alert('Notifications are off', 'Allow notifications for Knivy in your phone’s settings to get reminders.');
        update({ hydration: { ...hydration, reminders: { enabled: false, times, notificationIds: [] } } });
        return;
      }
      for (const t of times) ids.push(...(await scheduleReminder({ title: 'Water', body: 'A reminder to have a drink, if you need one.', time: t })));
    }
    update({ hydration: { ...hydration, reminders: { enabled, times, notificationIds: ids } } });
  };

  return (
    <Screen keyboard>
      <Stack.Screen options={{ title: 'Water' }} />
      <Card tone="water" hero>
        <Txt variant="label" tone="muted">
          Today
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
          <Txt variant="numberLarge">{volume.format(total, units)}</Txt>
          {goal ? <Txt tone="muted">of {volume.format(goal, units)}</Txt> : null}
        </View>
        {goal ? (
          <View style={{ marginTop: 10 }}>
            <ProgressBar value={total} max={goal} color={colors.water} />
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          {hydration.containers.map((c) => (
            <Button key={c.label} size="sm" variant="secondary" icon="add" label={`${c.label} ${volume.format(c.ml, units)}`} onPress={() => void add(c.ml, c.label)} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Field
              label="Custom amount"
              value={custom}
              onChangeText={(v) => {
                setCustom(v);
                form.clear('custom');
              }}
              keyboardType="decimal-pad"
              suffix={volume.unit(units)}
              error={form.errors.custom}
            />
          </View>
          <Button
            label="Add"
            onPress={() => {
              if (!form.apply({ custom: numberError(custom, amountRule) })) return;
              void add(Math.round(volume.fromDisplay(parseNumber(custom)!, units)), null).then(() => setCustom(''));
            }}
          />
        </View>
      </Card>

      <SectionHeader title="Today’s entries" />
      <Card padding={14}>
        {(entries.data ?? []).length === 0 ? (
          <EmptyState compact icon="water-outline" title="Nothing logged today" />
        ) : (
          (entries.data ?? []).map((e, i) => (
            <View key={e.id}>
              {i > 0 ? <Divider /> : null}
              {editing === e.id ? (
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Field
                      value={editAmount}
                      onChangeText={(v) => {
                        setEditAmount(v);
                        form.clear('edit');
                      }}
                      keyboardType="decimal-pad"
                      suffix={volume.unit(units)}
                      autoFocus
                      error={form.errors.edit}
                    />
                  </View>
                  <Button
                    size="sm"
                    label="Save"
                    onPress={async () => {
                      if (!form.apply({ edit: numberError(editAmount, amountRule) })) return;
                      const v = parseNumber(editAmount)!;
                      await repos.water.update(e.id, { ...e.data, amountMl: Math.round(volume.fromDisplay(v, units)) });
                      setEditing(null);
                    }}
                  />
                </View>
              ) : (
                <ListRow
                  title={volume.format(e.data.amountMl, units)}
                  subtitle={`${formatTime(e.recordedAt)}${e.data.container ? `, ${e.data.container}` : ''}`}
                  chevron={false}
                  right={
                    <View style={{ flexDirection: 'row' }}>
                      <IconButton
                        icon="create-outline"
                        tone="clear"
                        size={32}
                        label="Edit"
                        onPress={() => {
                          setEditing(e.id);
                          setEditAmount(String(Math.round(volume.toDisplay(e.data.amountMl, units))));
                        }}
                      />
                      <IconButton icon="trash-outline" tone="clear" size={32} label="Delete" onPress={() => confirmDelete('this entry', () => repos.water.remove(e.id))} />
                    </View>
                  }
                />
              )}
            </View>
          ))
        )}
      </Card>

      <SectionHeader title="Last 7 days" />
      <Card>
        <BarChart
          color={colors.water}
          goal={goal}
          format={(v) => volume.format(v, units)}
          data={week.map((k) => ({ label: WEEKDAYS_LETTER[weekdayOf(k)], value: byDay[k] ?? null }))}
        />
        <Txt variant="caption" tone="muted" style={{ marginTop: 6 }}>
          {Object.keys(byDay).length
            ? `Average ${volume.format(Object.values(byDay).reduce((a, b) => a + b, 0) / Object.keys(byDay).length, units)} on the ${Object.keys(byDay).length} days you logged.`
            : 'No water logged this week.'}
        </Txt>
      </Card>

      <SectionHeader title="Goal" />
      <Card>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Field
              label="Daily goal"
              value={goalText}
              onChangeText={(v) => {
                setGoalText(v);
                form.clear('goal');
              }}
              keyboardType="decimal-pad"
              suffix={volume.unit(units)}
              placeholder="No goal"
              error={form.errors.goal}
            />
          </View>
          <Button label="Save" variant="secondary" onPress={saveGoal} />
        </View>
        <Txt variant="caption" tone="muted" style={{ marginTop: 8 }}>
          Fluid needs vary with body size, climate, activity, pregnancy and some health conditions. If a clinician has given you a limit, use theirs.
        </Txt>
      </Card>

      <SectionHeader title="Quick-add sizes" />
      <Card padding={14}>
        {hydration.containers.map((c, i) => (
          <View key={`${c.label}-${i}`}>
            {i > 0 ? <Divider /> : null}
            <ListRow
              title={c.label}
              subtitle={volume.format(c.ml, units)}
              chevron={false}
              right={
                <IconButton
                  icon="close"
                  tone="clear"
                  size={30}
                  label={`Remove ${c.label}`}
                  onPress={() => update({ hydration: { ...hydration, containers: hydration.containers.filter((_, j) => j !== i) } })}
                />
              }
            />
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'flex-end' }}>
          <View style={{ flex: 1.2 }}>
            <Field
              label="Name"
              value={newLabel}
              onChangeText={(v) => {
                setNewLabel(v);
                form.clear('containerLabel');
              }}
              placeholder="Flask"
              maxLength={20}
              error={form.errors.containerLabel}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Size"
              value={newSize}
              onChangeText={(v) => {
                setNewSize(v);
                form.clear('containerSize');
              }}
              keyboardType="decimal-pad"
              suffix={volume.unit(units)}
              error={form.errors.containerSize}
            />
          </View>
          <Button
            label="Add"
            size="sm"
            onPress={() => {
              const label = newLabel.trim().toLowerCase();
              const ok = form.apply({
                containerLabel:
                  check.required('a name')(newLabel) ??
                  check.text()(newLabel) ??
                  (hydration.containers.some((c) => c.label.toLowerCase() === label) ? 'You already have a size with this name.' : null) ??
                  (hydration.containers.length >= 8 ? 'You can keep up to 8 quick-add sizes. Remove one first.' : null),
                containerSize: numberError(newSize, amountRule),
              });
              if (!ok) return;
              const v = parseNumber(newSize)!;
              update({ hydration: { ...hydration, containers: [...hydration.containers, { label: newLabel.trim(), ml: Math.round(volume.fromDisplay(v, units)) }] } });
              setNewLabel('');
              setNewSize('');
            }}
          />
        </View>
      </Card>

      <SectionHeader title="Reminders" />
      <Card>
        <ToggleRow
          label="Water reminders"
          description="Gentle reminders at the times you choose."
          value={hydration.reminders.enabled}
          onChange={(v) => void rescheduleReminders(hydration.reminders.times, v).catch(showError)}
        />
        {hydration.reminders.times.map((t) => (
          <ListRow
            key={t}
            title={formatHHMM(t)}
            chevron={false}
            right={
              <IconButton
                icon="close"
                tone="clear"
                size={30}
                label={`Remove ${t}`}
                onPress={() => void rescheduleReminders(hydration.reminders.times.filter((x) => x !== t), hydration.reminders.enabled).catch(showError)}
              />
            }
          />
        ))}
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end', marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <DateTimeField label="Add a time" value={reminderTime} onChange={setReminderTime} mode="time" />
          </View>
          <Button
            label="Add"
            size="sm"
            variant="secondary"
            onPress={() => {
              const t = toHHMM(reminderTime);
              if (hydration.reminders.times.includes(t)) return;
              void rescheduleReminders([...hydration.reminders.times, t].sort(), true).catch(showError);
            }}
          />
        </View>
      </Card>
      <Banner body="Reminders are delivered by your phone even when Knivy is closed." />
    </Screen>
  );
}
