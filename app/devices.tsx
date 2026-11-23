import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Stack } from 'expo-router';
import { Linking, View } from 'react-native';
import { Banner, Button, Card, Icon, Screen, SectionHeader, Txt } from '../src/components/ui';
import { useMotionStatus } from '../src/hooks/useSteps';
import { requestMotionPermission } from '../src/integrations/health/motion';
import { getAppleHealthStatus, getHealthConnectStatus, isExpoGo } from '../src/integrations/health/platforms';
import type { ProviderStatus } from '../src/integrations/health/types';
import { getNotificationPermission } from '../src/services/notifications';
import { colors } from '../src/theme/tokens';

function StatusDot({ on }: { on: boolean | null }) {
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: on ? colors.moss : on === false ? colors.danger : colors.taupe }} />;
}

function ProviderCard({ s, action }: { s: ProviderStatus; action?: ReactNode }) {
  return (
    <Card padding={16}>
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <StatusDot on={s.available ? s.granted : null} />
          <Txt variant="heading" style={{ flex: 1 }}>
            {s.name}
          </Txt>
          <Txt variant="caption" tone="muted">
            {!s.available ? 'Not available' : s.granted ? 'Connected' : 'Not allowed'}
          </Txt>
        </View>
        <Txt variant="caption" tone="muted">
          {s.note}
        </Txt>
        <Txt variant="caption" tone="muted">
          {s.available ? 'Provides' : 'Would provide'}: {s.supplies.join(', ')}
        </Txt>
        {action}
      </View>
    </Card>
  );
}

export default function Devices() {
  const qc = useQueryClient();
  const motion = useMotionStatus();
  const [camera] = useCameraPermissions();
  const location = useQuery({ queryKey: ['perm', 'location'], queryFn: () => Location.getForegroundPermissionsAsync() });
  const notif = useQuery({ queryKey: ['perm', 'notifications'], queryFn: getNotificationPermission });

  const perms: { label: string; why: string; granted: boolean | null }[] = [
    { label: 'Location', why: 'Only while recording an outdoor activity', granted: location.data?.granted ?? null },
    { label: 'Camera', why: 'Barcode scanning and meal photos', granted: camera?.granted ?? null },
    { label: 'Notifications', why: 'Reminders you set up', granted: notif.data?.granted ?? null },
  ];

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Connected devices' }} />
      {motion.data ? (
        <ProviderCard
          s={motion.data}
          action={
            motion.data.available && !motion.data.granted ? (
              motion.data.canAskAgain ? (
                <Button
                  size="sm"
                  label="Allow step access"
                  onPress={async () => {
                    await requestMotionPermission();
                    await qc.invalidateQueries({ queryKey: ['motion'] });
                    await qc.invalidateQueries({ queryKey: ['steps'] });
                  }}
                />
              ) : (
                <Button size="sm" variant="secondary" label="Open settings" onPress={() => void Linking.openSettings()} />
              )
            ) : null
          }
        />
      ) : null}
      <ProviderCard s={getAppleHealthStatus()} />
      <ProviderCard s={getHealthConnectStatus()} />
      {isExpoGo ? (
        <Banner title="Running in Expo Go" body="Apple Health and Health Connect need a Knivy development build. docs/NATIVE_HEALTH_SETUP.md in the project explains the steps." />
      ) : null}
      <Banner body="Knivy only shows measurements a source actually provides. A phone can’t measure blood pressure, blood oxygen or temperature without a dedicated device." />

      <SectionHeader title="Phone permissions" />
      <Card padding={14}>
        {perms.map((p) => (
          <View key={p.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}>
            <StatusDot on={p.granted} />
            <View style={{ flex: 1 }}>
              <Txt variant="bodyMedium">{p.label}</Txt>
              <Txt variant="caption" tone="muted">
                {p.why}
              </Txt>
            </View>
            <Txt variant="caption" tone="muted">
              {p.granted ? 'Allowed' : p.granted === false ? 'Not allowed' : 'Not asked'}
            </Txt>
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 6 }}>
          <Icon name="information-circle-outline" size={16} color={colors.muted} />
          <Txt variant="caption" tone="muted" style={{ flex: 1 }}>
            Knivy asks for each permission only when you use the feature that needs it. Revoke any of them in your phone’s settings.
          </Txt>
        </View>
        <Button size="sm" variant="secondary" label="Open phone settings" onPress={() => void Linking.openSettings()} />
      </Card>
    </Screen>
  );
}
