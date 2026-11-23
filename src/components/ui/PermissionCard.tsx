import { Linking, View } from 'react-native';
import { Button } from './Button';
import { Card } from './Card';
import { Icon, type IconName } from './Icon';
import { Txt } from './Txt';
import { colors } from '../../theme/tokens';

/** Explains why a permission is needed before asking, and handles "denied" with a path to Settings. */
export function PermissionCard({
  icon,
  title,
  why,
  canAskAgain,
  denied,
  onRequest,
  requestLabel = 'Allow access',
}: {
  icon: IconName;
  title: string;
  why: string;
  canAskAgain: boolean;
  denied?: boolean;
  onRequest: () => void;
  requestLabel?: string;
}) {
  return (
    <Card tone="linen">
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name={icon} color={colors.ink} />
          <Txt variant="heading" style={{ flex: 1 }}>
            {title}
          </Txt>
        </View>
        <Txt tone="muted">{why}</Txt>
        {denied && !canAskAgain ? (
          <>
            <Txt variant="caption" tone="muted">
              Access was turned off. You can turn it back on in your phone’s settings.
            </Txt>
            <Button label="Open settings" size="sm" variant="secondary" onPress={() => void Linking.openSettings()} />
          </>
        ) : (
          <Button label={requestLabel} size="sm" onPress={onRequest} />
        )}
      </View>
    </Card>
  );
}
