import { Touchable } from './Touchable';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '../../theme/tokens';
import { Icon, type IconName } from './Icon';
import { Txt } from './Txt';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
}

const STYLES = {
  primary: { bg: colors.ink, fg: colors.ivory },
  secondary: { bg: colors.sand, fg: colors.ink },
  ghost: { bg: 'transparent', fg: colors.ink },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
};

export function Button({ label, onPress, variant = 'primary', size = 'md', icon, loading, disabled, full }: ButtonProps) {
  const s = STYLES[variant];
  const inactive = disabled || loading;
  return (
    <Touchable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => ({
        backgroundColor: s.bg,
        borderRadius: 999,
        height: size === 'md' ? 52 : 38,
        paddingHorizontal: size === 'md' ? 22 : 14,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: full ? 'stretch' : 'flex-start',
        opacity: inactive ? 0.45 : pressed ? 0.8 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={s.fg} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon ? <Icon name={icon} size={size === 'md' ? 18 : 16} color={s.fg} /> : null}
          <Txt variant={size === 'md' ? 'heading' : 'label'} style={{ color: s.fg }}>
            {label}
          </Txt>
        </View>
      )}
    </Touchable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  tone = 'sand',
  size = 40,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  tone?: 'sand' | 'paper' | 'ink' | 'clear';
  size?: number;
}) {
  const bg = tone === 'sand' ? colors.sand : tone === 'paper' ? colors.paper : tone === 'ink' ? colors.ink : 'transparent';
  return (
    <Touchable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon name={icon} size={size * 0.48} color={tone === 'ink' ? colors.ivory : colors.ink} />
    </Touchable>
  );
}
