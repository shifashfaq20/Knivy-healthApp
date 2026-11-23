import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Card, Divider, ListRow, PageHeader, Screen, ToggleRow, Txt, type IconName } from '../../src/components/ui';
import { useRecords } from '../../src/hooks/useRecords';
import { repos } from '../../src/repositories';
import { pendingChanges } from '../../src/services/sync/syncEngine';
import { useProfile } from '../../src/stores/profileStore';
import { ageFromDob } from '../../src/utils/date';
import { height, weight } from '../../src/utils/units';

type Row = { title: string; subtitle?: string; icon: IconName; go: () => void };

export default function ProfileTab() {
  const p = useProfile();
  const measures = useRecords(repos.measurements, { limit: 200 });
  const latestWeight = measures.data?.find((m) => m.data.type === 'weight');
  const pending = useQuery({ queryKey: ['records', 'sync-pending'], queryFn: pendingChanges });
  const age = ageFromDob(p.dateOfBirth);

  const sections: { title: string; rows: Row[] }[] = [
    {
      title: 'You',
      rows: [
        { title: 'Personal details', subtitle: 'Name, date of birth, height, diet and allergies', icon: 'person-outline', go: () => router.push('/profile/edit') },
        { title: 'Goals', subtitle: 'Activity, nutrition, water and sleep', icon: 'flag-outline', go: () => router.push('/profile/goals') },
        { title: 'Health records', subtitle: 'Medications, allergies, history, documents', icon: 'folder-open-outline', go: () => router.push('/records') },
      ],
    },
    {
      title: 'App',
      rows: [
        { title: 'Customise home', icon: 'options-outline', go: () => router.push('/dashboard') },
        { title: 'Connected devices', subtitle: 'Step sensor, Apple Health, Health Connect', icon: 'watch-outline', go: () => router.push('/devices') },
        { title: 'Reminders', icon: 'notifications-outline', go: () => router.push('/notifications') },
        { title: 'Settings and privacy', subtitle: 'Units, locks, export, delete', icon: 'settings-outline', go: () => router.push('/settings') },
      ],
    },
  ];

  return (
    <Screen tab>
      <PageHeader title={p.name || 'Profile'} />
      <Card hero>
        <View style={{ flexDirection: 'row', gap: 24 }}>
          <View>
            <Txt variant="caption" tone="muted">
              Age
            </Txt>
            <Txt variant="heading">{age !== null ? age : 'Not set'}</Txt>
          </View>
          <View>
            <Txt variant="caption" tone="muted">
              Height
            </Txt>
            <Txt variant="heading">{p.heightCm ? height.format(p.heightCm, p.units) : 'Not set'}</Txt>
          </View>
          <View>
            <Txt variant="caption" tone="muted">
              Weight
            </Txt>
            <Txt variant="heading">{latestWeight ? weight.format(latestWeight.data.value, p.units) : 'Not set'}</Txt>
          </View>
        </View>
      </Card>

      {sections.map((s) => (
        <View key={s.title} style={{ gap: 8 }}>
          <Txt variant="subtitle">{s.title}</Txt>
          <Card padding={14}>
            {s.rows.map((r, i) => (
              <View key={r.title}>
                {i > 0 ? <Divider /> : null}
                <ListRow title={r.title} subtitle={r.subtitle} icon={r.icon} onPress={r.go} />
              </View>
            ))}
          </Card>
        </View>
      ))}

      <Card>
        <ToggleRow
          label="Cycle tracking"
          description="Optional. Everything else works without it."
          value={p.features.cycleTracking}
          onChange={(v) => p.update({ features: { ...p.features, cycleTracking: v } })}
        />
        {p.features.cycleTracking ? <ListRow title="Open cycle calendar" icon="flower-outline" onPress={() => router.push('/cycle')} /> : null}
      </Card>

      <Card tone="linen">
        <Txt variant="heading">Account and sync</Txt>
        <Txt tone="muted" style={{ marginTop: 4 }}>
          Accounts and syncing across devices arrive with the Knivy backend. For now everything is stored only on this phone
          {pending.data ? `, with ${pending.data} change${pending.data === 1 ? '' : 's'} ready to sync later` : ''}.
        </Txt>
      </Card>
      <Txt variant="caption" tone="muted">
        Knivy is free. It’s a wellness tool, not a medical device, and doesn’t diagnose or treat any condition.
      </Txt>
    </Screen>
  );
}
