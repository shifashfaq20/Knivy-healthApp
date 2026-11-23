import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Banner, Button, Card, Segmented, Screen, SectionHeader, ToggleRow, Txt } from '../src/components/ui';
import { deleteAllLocalData, exportAllData } from '../src/services/dataExport';
import { queryClient } from '../src/services/queryClient';
import { pendingChanges, syncNow } from '../src/services/sync/syncEngine';
import { useLock } from '../src/stores/lockStore';
import { useProfile } from '../src/stores/profileStore';
import { useWorkoutSession } from '../src/stores/sessionStore';
import { showError } from '../src/utils/alerts';
import { deviceTimeZone } from '../src/utils/date';

export default function Settings() {
  const p = useProfile();
  const clearSession = useWorkoutSession((s) => s.clear);
  const lockAll = useLock((s) => s.lockAll);
  const pending = useQuery({ queryKey: ['sync', 'pending'], queryFn: pendingChanges });
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null);

  const setLock = async (area: 'lockJournal' | 'lockRecords', value: boolean) => {
    if (value) {
      const ok = (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
      if (!ok) {
        Alert.alert('No screen lock set up', 'Set up a passcode, fingerprint or Face ID on this phone first.');
        return;
      }
    }
    p.update({ privacy: { ...p.privacy, [area]: value } });
    lockAll();
  };

  const doExport = async () => {
    setBusy('export');
    try {
      await exportAllData();
    } catch (e) {
      showError(e, 'Export failed');
    } finally {
      setBusy(null);
    }
  };

  const doDelete = () =>
    Alert.alert('Delete all your data?', 'Every record, document, reminder and setting on this phone will be permanently deleted. Export first if you want a copy.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue',
        style: 'destructive',
        onPress: () =>
          Alert.alert('This can’t be undone', 'Delete everything now?', [
            { text: 'Keep my data', style: 'cancel' },
            {
              text: 'Delete everything',
              style: 'destructive',
              onPress: async () => {
                setBusy('delete');
                try {
                  await deleteAllLocalData();
                  clearSession();
                  p.reset();
                  queryClient.clear();
                  router.replace('/onboarding');
                } catch (e) {
                  showError(e, 'Couldn’t delete everything');
                } finally {
                  setBusy(null);
                }
              },
            },
          ]),
      },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Settings and privacy' }} />

      <SectionHeader title="Units" />
      <Card>
        <View style={{ gap: 12 }}>
          <Segmented options={[{ label: 'kg', value: 'kg' }, { label: 'lb', value: 'lb' }]} value={p.units.weight} onChange={(v) => p.setUnits({ weight: v })} />
          <Segmented options={[{ label: 'cm', value: 'cm' }, { label: 'ft / in', value: 'ftin' }]} value={p.units.height} onChange={(v) => p.setUnits({ height: v })} />
          <Segmented options={[{ label: 'km', value: 'km' }, { label: 'miles', value: 'mi' }]} value={p.units.distance} onChange={(v) => p.setUnits({ distance: v })} />
          <Segmented options={[{ label: 'ml', value: 'ml' }, { label: 'fl oz', value: 'oz' }]} value={p.units.volume} onChange={(v) => p.setUnits({ volume: v })} />
          <Segmented options={[{ label: '°C', value: 'c' }, { label: '°F', value: 'f' }]} value={p.units.temperature} onChange={(v) => p.setUnits({ temperature: v })} />
          <Txt variant="caption" tone="muted">
            Values are stored in metric and converted for display, so switching units never changes your data.
          </Txt>
        </View>
      </Card>

      <SectionHeader title="Language and time" />
      <Card>
        <Txt variant="bodyMedium">Language: English</Txt>
        <Txt variant="caption" tone="muted">
          More languages will follow. Dates and numbers already follow your phone’s region.
        </Txt>
        <Txt variant="bodyMedium" style={{ marginTop: 12 }}>
          Time zone: {deviceTimeZone()}
        </Txt>
        <Txt variant="caption" tone="muted">
          Knivy uses your phone’s time zone for days and stores times in UTC, so records stay correct when you travel.
        </Txt>
      </Card>

      <SectionHeader title="Features" />
      <Card>
        <ToggleRow label="Cycle tracking" value={p.features.cycleTracking} onChange={(v) => p.update({ features: { ...p.features, cycleTracking: v } })} />
        <ToggleRow
          label="Use phone step data"
          description="Turn off to stop Knivy reading the motion sensor. To revoke access fully, use your phone’s settings."
          value={p.features.useMotion}
          onChange={(v) => {
            p.update({ features: { ...p.features, useMotion: v } });
            void queryClient.invalidateQueries({ queryKey: ['steps'] });
          }}
        />
      </Card>

      <SectionHeader title="Privacy" />
      <Card>
        <ToggleRow label="Lock journal" description="Ask for your phone’s passcode or biometrics." value={p.privacy.lockJournal} onChange={(v) => void setLock('lockJournal', v)} />
        <ToggleRow label="Lock health records" description="Medications, history and documents." value={p.privacy.lockRecords} onChange={(v) => void setLock('lockRecords', v)} />
      </Card>
      <Banner
        icon="shield-checkmark-outline"
        body="Your data is stored in Knivy’s private storage on this phone and isn’t sent anywhere, except food searches (sent to the food database) and photos you choose to analyse once the AI service exists. Knivy has no ads and will never sell identifiable health information."
      />

      <SectionHeader title="Account and sync" />
      <Card>
        <Txt tone="muted">
          Accounts, sign-in and syncing between devices need the Knivy backend, which isn’t part of this version. {pending.data ? `${pending.data} changes are saved locally and marked to sync later.` : ''}
        </Txt>
        <View style={{ marginTop: 10 }}>
          <Button
            size="sm"
            variant="secondary"
            icon="sync-outline"
            label="Sync now"
            onPress={async () => {
              const r = await syncNow();
              Alert.alert(r.status === 'ok' ? 'Synced' : 'Sync unavailable', r.status === 'ok' ? `${r.pushed} changes uploaded.` : r.message);
            }}
          />
        </View>
      </Card>

      <SectionHeader title="Your data" />
      <Card>
        <View style={{ gap: 10 }}>
          <Txt tone="muted">Export everything as a JSON file you can keep or move elsewhere. Documents stay as files in Knivy and can be shared individually.</Txt>
          <Button label="Export all data" icon="download-outline" variant="secondary" loading={busy === 'export'} onPress={() => void doExport()} />
          <Button label="Delete all data" icon="trash-outline" variant="danger" loading={busy === 'delete'} onPress={doDelete} />
        </View>
      </Card>

      <SectionHeader title="About" />
      <Card tone="linen">
        <Txt variant="bodyMedium">Knivy {Constants.expoConfig?.version ?? ''}</Txt>
        <Txt variant="caption" tone="muted" style={{ marginTop: 4 }}>
          Free, with no subscriptions or paid features. Knivy is a wellness app, not a medical device. It doesn’t diagnose, treat or prevent any condition. Food data from Open Food Facts (Open Database Licence) and, when enabled, USDA FoodData Central.
        </Txt>
      </Card>
    </Screen>
  );
}
