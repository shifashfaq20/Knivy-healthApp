import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { BarChart } from '../../src/components/charts/Charts';
import { Button, Card, DateTimeField, Divider, EmptyState, ListRow, Screen, SectionHeader, Segmented, SourceBadge, ToggleRow, Txt } from '../../src/components/ui';
import { useRecords } from '../../src/hooks/useRecords';
import { repos } from '../../src/repositories';
import { cancelReminders, ensureNotificationPermission, scheduleReminder } from '../../src/services/notifications';
import { useProfile } from '../../src/stores/profileStore';
import { colors } from '../../src/theme/tokens';
import { showError } from '../../src/utils/alerts';
import { addDaysKey, formatDate, formatDuration, formatHHMM, formatTime, hhmmToDate, isoToKey, keysRange, lastNDays, parseDateKey, todayKey, toHHMM } from '../../src/utils/date';
import { num } from '../../src/utils/units';

const hoursOf = (s: { start: string; end: string }) => (new Date(s.end).getTime() - new Date(s.start).getTime()) / 3_600_000;

function avgClock(isos: string[], shiftNoon: boolean) {
  if (!isos.length) return null;
  // Average minutes after midnight; bedtimes are shifted so 23:00 and 01:00 average to 00:00.
  const mins = isos.map((iso) => {
    const d = new Date(iso);
    let m = d.getHours() * 60 + d.getMinutes();
    if (shiftNoon && m < 12 * 60) m += 24 * 60;
    return m;
  });
  const avg = Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) % (24 * 60);
  return `${String(Math.floor(avg / 60)).padStart(2, '0')}:${String(avg % 60).padStart(2, '0')}`;
}

export default function Sleep() {
  const [range, setRange] = useState<'14' | '30'>('14');
  const goal = useProfile((s) => s.goals.sleepHours);
  const reminder = useProfile((s) => s.sleepReminder);
  const update = useProfile((s) => s.update);
  const days = lastNDays(Number(range));
  const sessions = useRecords(repos.sleep, keysRange(days[0], days[days.length - 1]));
  const month = lastNDays(30);
  const measures = useRecords(repos.measurements, keysRange(month[0], month[29]));
  const workouts = useRecords(repos.workoutSessions, keysRange(addDaysKey(todayKey(), -6), todayKey()));
  const [time, setTime] = useState<Date>(() => hhmmToDate(reminder.times[0] ?? '22:30'));

  const list = sessions.data ?? [];
  const byNight = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of list) m[isoToKey(s.data.end)] = (m[isoToKey(s.data.end)] ?? 0) + hoursOf(s.data);
    return m;
  }, [list]);
  const nights = Object.values(byNight);
  const avg = nights.length ? nights.reduce((a, b) => a + b, 0) / nights.length : null;
  const avgBed = avgClock(list.map((s) => s.data.start), true);
  const avgWake = avgClock(list.map((s) => s.data.end), false);

  const rhr = (measures.data ?? []).filter((m) => m.data.type === 'resting_heart_rate');
  const rhrLatest = rhr[0]?.data.value ?? null;
  const rhrAvg = rhr.length >= 3 ? rhr.reduce((s, m) => s + m.data.value, 0) / rhr.length : null;

  const setReminder = async (enabled: boolean, at: Date) => {
    try {
      await cancelReminders(reminder.notificationIds);
      if (!enabled) return update({ sleepReminder: { enabled: false, times: reminder.times, notificationIds: [] } });
      if (!(await ensureNotificationPermission())) {
        Alert.alert('Notifications are off', 'Allow notifications for Knivy in Settings to get a bedtime reminder.');
        return update({ sleepReminder: { enabled: false, times: reminder.times, notificationIds: [] } });
      }
      const t = toHHMM(at);
      const ids = await scheduleReminder({ title: 'Wind down', body: 'Your bedtime is coming up.', time: t });
      update({ sleepReminder: { enabled: true, times: [t], notificationIds: ids } });
    } catch (e) {
      showError(e);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Sleep' }} />
      <Button full label="Log sleep" icon="add" onPress={() => router.push('/sleep/log')} />
      <Segmented options={[{ label: '14 nights', value: '14' }, { label: '30 nights', value: '30' }]} value={range} onChange={setRange} />
      <Card>
        <BarChart
          color={colors.ink}
          goal={goal}
          format={(v) => `${num(v)} h`}
          data={days.map((k) => ({ label: String(parseDateKey(k).getDate()), value: byNight[k] ?? null }))}
        />
        <View style={{ flexDirection: 'row', marginTop: 12, gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Txt variant="heading">{avg !== null ? `${num(avg)} h` : 'None'}</Txt>
            <Txt variant="caption" tone="muted">
              {avg !== null ? `average, ${nights.length} nights` : 'no nights logged'}
            </Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="heading">{avgBed ? formatHHMM(avgBed) : 'None'}</Txt>
            <Txt variant="caption" tone="muted">
              typical bedtime
            </Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="heading">{avgWake ? formatHHMM(avgWake) : 'None'}</Txt>
            <Txt variant="caption" tone="muted">
              typical wake time
            </Txt>
          </View>
        </View>
      </Card>

      <SectionHeader title="Recovery" />
      <Card tone="linen">
        <View style={{ gap: 8 }}>
          {avg === null && rhrLatest === null && !(workouts.data ?? []).length ? (
            <Txt tone="muted">Log sleep, resting heart rate or workouts and Knivy will summarise them here.</Txt>
          ) : null}
          {avg !== null && goal ? (
            <Txt>
              Your average of {num(avg)} h is {avg >= goal ? 'at or above' : `${num(goal - avg)} h below`} your {goal} h goal.
            </Txt>
          ) : null}
          {rhrLatest !== null && rhrAvg !== null ? (
            <Txt>
              Latest resting heart rate is {Math.round(rhrLatest)} bpm; your 30-day average is {Math.round(rhrAvg)} bpm.
            </Txt>
          ) : null}
          <Txt>{(workouts.data ?? []).length} workouts in the last 7 days.</Txt>
          <Txt variant="caption" tone="muted">
            These are summaries of your own records, not a medical assessment.
          </Txt>
        </View>
      </Card>

      <SectionHeader title="Nights" />
      <Card padding={14}>
        {list.length === 0 ? (
          <EmptyState compact icon="moon-outline" title="No sleep recorded" body="Sleep stages appear only when a connected device provides them." />
        ) : (
          list.map((s, i) => (
            <View key={s.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                title={formatDuration(hoursOf(s.data) * 60)}
                subtitle={`${formatDate(s.data.end, true)}, ${formatTime(s.data.start)} to ${formatTime(s.data.end)}${s.data.quality ? `, rated ${s.data.quality}/5` : ''}${s.data.stages?.length ? ', includes stages' : ''}`}
                right={<SourceBadge source={s.source} />}
                onPress={() => router.push({ pathname: '/sleep/log', params: { id: s.id } })}
              />
            </View>
          ))
        )}
      </Card>

      <SectionHeader title="Bedtime reminder" />
      <Card>
        <ToggleRow label="Remind me to wind down" value={reminder.enabled} onChange={(v) => void setReminder(v, time)} />
        <DateTimeField
          label="Reminder time"
          mode="time"
          value={time}
          onChange={(d) => {
            setTime(d);
            if (reminder.enabled) void setReminder(true, d);
          }}
        />
      </Card>
    </Screen>
  );
}
