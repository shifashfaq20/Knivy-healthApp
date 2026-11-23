import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { LineChart } from '../../src/components/charts/Charts';
import { Button, Card, DateTimeField, Divider, EmptyState, Icon, ListRow, Screen, SectionHeader, ToggleRow, Txt, type IconName } from '../../src/components/ui';
import { MOOD_LABELS, STRESS_LABELS } from '../../src/features/mind/content';
import { useRecords } from '../../src/hooks/useRecords';
import { repos } from '../../src/repositories';
import { cancelReminders, ensureNotificationPermission, scheduleReminder } from '../../src/services/notifications';
import { useProfile } from '../../src/stores/profileStore';
import { colors } from '../../src/theme/tokens';
import { showError } from '../../src/utils/alerts';
import { dayRange, formatTime, hhmmToDate, isoToKey, keysRange, lastNDays, parseDateKey, relativeDay, todayKey, toHHMM } from '../../src/utils/date';

export default function Mind() {
  const today = todayKey();
  const todays = useRecords(repos.moods, dayRange(today));
  const days = lastNDays(30);
  const month = useRecords(repos.moods, keysRange(days[0], days[29]));
  const reminder = useProfile((s) => s.mindReminder);
  const update = useProfile((s) => s.update);
  const [time, setTime] = useState(() => hhmmToDate(reminder.times[0] ?? '20:00'));

  const daily = useMemo(() => {
    const m: Record<string, { mood: number[]; stress: number[] }> = {};
    for (const r of month.data ?? []) {
      const k = isoToKey(r.recordedAt);
      m[k] ??= { mood: [], stress: [] };
      m[k].mood.push(r.data.mood);
      if (r.data.stress) m[k].stress.push(r.data.stress);
    }
    return m;
  }, [month.data]);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  const tagCounts = useMemo(() => {
    const c: Record<string, { n: number; mood: number }> = {};
    for (const r of month.data ?? []) for (const t of r.data.tags) {
      c[t] ??= { n: 0, mood: 0 };
      c[t].n++;
      c[t].mood += r.data.mood;
    }
    return Object.entries(c)
      .filter(([, v]) => v.n >= 2)
      .sort((a, b) => b[1].n - a[1].n)
      .slice(0, 4);
  }, [month.data]);

  const setReminder = async (enabled: boolean, at: Date) => {
    try {
      await cancelReminders(reminder.notificationIds);
      if (!enabled) return update({ mindReminder: { enabled: false, times: reminder.times, notificationIds: [] } });
      if (!(await ensureNotificationPermission())) {
        Alert.alert('Notifications are off', 'Allow notifications for Knivy in Settings to get a check-in reminder.');
        return update({ mindReminder: { enabled: false, times: reminder.times, notificationIds: [] } });
      }
      const t = toHHMM(at);
      const ids = await scheduleReminder({ title: 'How are you today?', body: 'Take a moment to check in.', time: t });
      update({ mindReminder: { enabled: true, times: [t], notificationIds: ids } });
    } catch (e) {
      showError(e);
    }
  };

  const tools: { label: string; body: string; icon: IconName; href: '/mind/journal' | '/mind/breathe' | '/mind/practice' }[] = [
    { label: 'Journal', body: 'Private notes, only on this phone', icon: 'book-outline', href: '/mind/journal' },
    { label: 'Breathing', body: 'Paced breathing, one to five minutes', icon: 'cloud-outline', href: '/mind/breathe' },
    { label: 'Guided practices', body: 'Meditation, grounding and relaxation', icon: 'leaf-outline', href: '/mind/practice' },
  ];

  const latest = todays.data?.[0];

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Mind' }} />
      <Card hero tone="moss" onPress={() => router.push('/mind/checkin')}>
        <Txt variant="label" tone="muted">
          Today
        </Txt>
        {latest ? (
          <>
            <Txt variant="title" style={{ marginTop: 4 }}>
              Feeling {MOOD_LABELS[latest.data.mood - 1].toLowerCase()}
            </Txt>
            <Txt tone="muted">
              Checked in at {formatTime(latest.recordedAt)}
              {latest.data.stress ? `, stress ${STRESS_LABELS[latest.data.stress - 1].toLowerCase()}` : ''}. Tap to check in again.
            </Txt>
          </>
        ) : (
          <>
            <Txt variant="title" style={{ marginTop: 4 }}>
              How are you feeling?
            </Txt>
            <Txt tone="muted">A ten-second check-in. Patterns appear as you go.</Txt>
          </>
        )}
      </Card>

      {tools.map((t) => (
        <Card key={t.label} onPress={() => router.push(t.href)} padding={16}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Icon name={t.icon} />
            <View style={{ flex: 1 }}>
              <Txt variant="heading">{t.label}</Txt>
              <Txt variant="caption" tone="muted">
                {t.body}
              </Txt>
            </View>
            <Icon name="chevron-forward" size={16} color={colors.taupe} />
          </View>
        </Card>
      ))}

      <SectionHeader title="Last 30 days" />
      <Card>
        <Txt variant="caption" tone="muted">
          Mood, 1 (very low) to 5 (great)
        </Txt>
        <LineChart min={1} max={5} color={colors.moss} data={days.map((k) => ({ label: String(parseDateKey(k).getDate()), value: avg(daily[k]?.mood ?? []) }))} format={(v) => v.toFixed(0)} />
        <Divider />
        <Txt variant="caption" tone="muted" style={{ marginTop: 10 }}>
          Stress, 1 (calm) to 5 (very high)
        </Txt>
        <LineChart min={1} max={5} color={colors.rose} height={110} data={days.map((k) => ({ label: String(parseDateKey(k).getDate()), value: avg(daily[k]?.stress ?? []) }))} format={(v) => v.toFixed(0)} />
      </Card>
      {tagCounts.length ? (
        <Card tone="linen">
          <Txt variant="label" tone="muted">
            What you tagged most
          </Txt>
          {tagCounts.map(([tag, v]) => (
            <Txt key={tag} style={{ marginTop: 6 }}>
              {tag}: {v.n} check-ins, average mood {(v.mood / v.n).toFixed(1)}
            </Txt>
          ))}
          <Txt variant="caption" tone="muted" style={{ marginTop: 8 }}>
            Patterns in your own entries, not conclusions about cause.
          </Txt>
        </Card>
      ) : null}

      <SectionHeader title="Check-ins" />
      <Card padding={14}>
        {(month.data ?? []).length === 0 ? (
          <EmptyState compact icon="happy-outline" title="No check-ins yet" />
        ) : (
          (month.data ?? []).slice(0, 15).map((r, i) => (
            <View key={r.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                title={MOOD_LABELS[r.data.mood - 1]}
                subtitle={[`${relativeDay(isoToKey(r.recordedAt))}, ${formatTime(r.recordedAt)}`, r.data.tags.join(', '), r.data.note].filter(Boolean).join('\n')}
                onPress={() => router.push({ pathname: '/mind/checkin', params: { id: r.id } })}
              />
            </View>
          ))
        )}
      </Card>

      <SectionHeader title="Reminder" />
      <Card>
        <ToggleRow label="Daily check-in reminder" value={reminder.enabled} onChange={(v) => void setReminder(v, time)} />
        <DateTimeField
          label="Time"
          mode="time"
          value={time}
          onChange={(d) => {
            setTime(d);
            if (reminder.enabled) void setReminder(true, d);
          }}
        />
      </Card>
      <Card tone="outline">
        <Txt variant="heading">If you’re struggling</Txt>
        <Txt tone="muted" style={{ marginTop: 4 }}>
          Knivy can’t provide care or crisis support. If you feel unsafe, call your local emergency number. findahelpline.com lists free, confidential helplines in many countries.
        </Txt>
      </Card>
    </Screen>
  );
}
