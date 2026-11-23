// Design tokens. Colours mirror src/theme/palette.js (used by Tailwind).
export const colors = {
  ivory: '#FBF8F2',
  paper: '#FFFFFF',
  linen: '#F5EFE5',
  sand: '#ECE3D5',
  stone: '#DDD3C5',
  taupe: '#A6998A',
  muted: '#776C61',
  ink: '#2B2722',
  moss: '#56654B',
  mossSoft: '#E3E7DA',
  water: '#5F7C8F',
  waterSoft: '#E1E8EC',
  rose: '#A9786F',
  roseSoft: '#F1E4E0',
  danger: '#9B4A3B',
  dangerSoft: '#F3E2DD',
} as const;

export type ColorName = keyof typeof colors;

export const fonts = {
  display: 'Newsreader_500Medium',
  displayRegular: 'Newsreader_400Regular',
  body: 'HankenGrotesk_400Regular',
  bodyMedium: 'HankenGrotesk_500Medium',
  bodyStrong: 'HankenGrotesk_600SemiBold',
} as const;

export const radii = {
  hero: 30,
  card: 22,
  control: 14,
  chip: 999,
} as const;

export const shadow = {
  shadowColor: '#5A4A3A',
  shadowOpacity: 0.07,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;
