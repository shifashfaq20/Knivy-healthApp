import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useLock } from '../../stores/lockStore';
import { useProfile } from '../../stores/profileStore';
import { colors } from '../../theme/tokens';
import { Button } from './Button';
import { Icon } from './Icon';
import { Txt } from './Txt';

/** Hides private content behind the phone's biometrics/passcode when the user turned the lock on. */
export function LockGate({ area, children }: { area: 'journal' | 'records'; children: ReactNode }) {
  const enabled = useProfile((s) => (area === 'journal' ? s.privacy.lockJournal : s.privacy.lockRecords));
  const unlockedUntil = useLock((s) => s.unlockedUntil[area]);
  const unlock = useLock((s) => s.unlock);
  const [message, setMessage] = useState<string | null>(null);

  if (!enabled || unlockedUntil > Date.now()) return <>{children}</>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.ivory, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="lock-closed-outline" size={24} />
      </View>
      <Txt variant="title" center>
        {area === 'journal' ? 'Your journal is locked' : 'Your records are locked'}
      </Txt>
      <Txt tone="muted" center>
        Unlock with your phone’s passcode, fingerprint or Face ID.
      </Txt>
      {message ? (
        <Txt variant="caption" tone="danger" center>
          {message}
        </Txt>
      ) : null}
      <Button
        label="Unlock"
        icon="lock-open-outline"
        onPress={async () => {
          const res = await unlock(area);
          setMessage(res.ok ? null : res.message ?? 'Not unlocked.');
        }}
      />
    </View>
  );
}
