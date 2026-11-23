import { Text, type TextProps, type TextStyle } from 'react-native';
import { colors, fonts } from '../../theme/tokens';

export type TxtVariant =
  | 'display'
  | 'title'
  | 'subtitle'
  | 'heading'
  | 'body'
  | 'bodyMedium'
  | 'label'
  | 'caption'
  | 'number'
  | 'numberLarge';

export type TxtTone = 'ink' | 'muted' | 'faint' | 'moss' | 'danger' | 'inverse' | 'water' | 'rose';

const VARIANTS: Record<TxtVariant, TextStyle> = {
  display: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, letterSpacing: -0.5 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, letterSpacing: -0.3 },
  subtitle: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26, letterSpacing: -0.1 },
  heading: { fontFamily: fonts.bodyStrong, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  number: { fontFamily: fonts.bodyStrong, fontSize: 22, lineHeight: 28, fontVariant: ['tabular-nums'] },
  numberLarge: { fontFamily: fonts.display, fontSize: 46, lineHeight: 52, letterSpacing: -1, fontVariant: ['tabular-nums'] },
};

const TONES: Record<TxtTone, string> = {
  ink: colors.ink,
  muted: colors.muted,
  faint: colors.taupe,
  moss: colors.moss,
  danger: colors.danger,
  inverse: colors.ivory,
  water: colors.water,
  rose: colors.rose,
};

export interface TxtProps extends TextProps {
  variant?: TxtVariant;
  tone?: TxtTone;
  center?: boolean;
}

export function Txt({ variant = 'body', tone = 'ink', style, center, ...rest }: TxtProps) {
  return (
    <Text
      maxFontSizeMultiplier={1.6}
      style={[VARIANTS[variant], { color: TONES[tone] }, center ? { textAlign: 'center' } : null, style]}
      {...rest}
    />
  );
}
