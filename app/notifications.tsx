import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationRequest } from 'expo-notifications';
import { Stack, router } from 'expo-router';
import { Linking, View } from 'react-native';
import { Banner, Button, Card, Divider, EmptyState, ListRow, Screen, SectionHeader, Txt } from '../src/components/ui';
import { ensureNotificationPermission, getNotificationPermission, listScheduledReminders } from '../src/services/notifications';
import { WEEKDAYS_SHORT } from '../src/utils/date';

function describeTrigger(n: NotificationRequest) {
  const t = n.trigger as unknown as Record<string, unknown> | null;
  if (!t) return 'Scheduled';
  const comps = (t.dateComponents as Record<string, number> | undefined) ?? (t as Record<string, number>);
  const hour = typeof comps.hour === 'number' ? comps.hour : null;
  const minute = typeof comps.minute === 'number' ? comps.minute : 0;
  const weekday = typeof comps.weekday === 'number' ? comps.weekday : null;
  if (hour === null) return 'Scheduled';
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return weekday ? `${WEEKDAYS_SHORT[weekday - 1]} at ${time}` : `Every day at ${time}`;
}

export default function Notifications() {
  const qc = useQueryClient();
  const perm = useQuery({ queryKey: ['perm', 'notifications'], queryFn: getNotificationPermission });
  const scheduled = useQuery({ queryKey: ['notifications', 'scheduled'], queryFn: listScheduledReminders });

  const places = [
    { title: 'Medications', go: () => router.push('/records/medications') },
    { title: 'Water', go: () => router.push('/hydration') },
    { title: 'Habits', go: () => router.push('/habits') },
    { title: 'Sleep', go: () => router.push('/sleep') },
    { title: 'Mood check-in', go: () => router.push('/mind') },
  ];

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Reminders' }} />
      {perm.data && !perm.data.granted ? (
        <Card tone="linen">
          <Txt variant="heading">Notifications are off</Txt>
          <Txt tone="muted" style={{ marginTop: 4 }}>
            Knivy uses notifications only for reminders you set up.
          </Txt>
          <View style={{ marginTop: 10 }}>
            {perm.data.canAskAgain ? (
              <Button
                size="sm"
                label="Allow notifications"
                onPress={async () => {
                  await ensureNotificationPermission();
                  await qc.invalidateQueries({ queryKey: ['perm'] });
                }}
              />
            ) : (
              <Button size="sm" variant="secondary" label="Open settings" onPress={() => void Linking.openSettings()} />
            )}
          </View>
        </Card>
      ) : null}

      <SectionHeader title="Scheduled" />
      <Card padding={14}>
        {(scheduled.data ?? []).length === 0 ? (
          <EmptyState compact icon="notifications-outline" title="No reminders scheduled" />
        ) : (
          (scheduled.data ?? []).map((n, i) => (
            <View key={n.identifier}>
              {i > 0 ? <Divider /> : null}
              <ListRow title={n.content.title ?? 'Reminder'} subtitle={describeTrigger(n)} />
            </View>
          ))
        )}
      </Card>

      <SectionHeader title="Set reminders for" />
      <Card padding={14}>
        {places.map((p, i) => (
          <View key={p.title}>
            {i > 0 ? <Divider /> : null}
            <ListRow title={p.title} onPress={p.go} />
          </View>
        ))}
      </Card>
      <Banner body="Reminders are delivered by your phone, so they work offline and when Knivy is closed." />
    </Screen>
  );
}
