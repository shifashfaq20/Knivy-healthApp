import { Touchable } from './Touchable';
import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { colors, radii, shadow } from '../../theme/tokens';

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  tone?: 'paper' | 'sand' | 'linen' | 'outline' | 'moss' | 'water' | 'rose';
  hero?: boolean;
  padding?: number;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

const BG: Record<NonNullable<CardProps['tone']>, string> = {
  paper: colors.paper,
  sand: colors.sand,
  linen: colors.linen,
  outline: 'transparent',
  moss: colors.mossSoft,
  water: colors.waterSoft,
  rose: colors.roseSoft,
};

export function Card({ children, onPress, tone = 'paper', hero, padding = 18, style, accessibilityLabel }: CardProps) {
  const base: ViewStyle = {
    backgroundColor: BG[tone],
    borderRadius: hero ? radii.hero : radii.card,
    padding,
    ...(tone === 'paper' ? shadow : null),
    ...(tone === 'outline' ? { borderWidth: 1, borderColor: colors.stone } : null),
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Touchable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [base, style, pressed ? { opacity: 0.85, transform: [{ scale: 0.995 }] } : null]}
    >
      {children}
    </Touchable>
  );
}
