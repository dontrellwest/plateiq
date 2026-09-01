// Design tokens (README "Design tokens", option 1e). Colours come from the ported palette(); this
// file adds the type ramp, radii, motion constants and the Archivo font-family mapping.

import { Platform } from 'react-native';
import type { TextStyle } from 'react-native';
import { useStore, useTokens } from '../store/useStore';
import type { Palette } from '../logic/PlateIQLogic';

export const RADIUS = { chip: 10, control: 13, card: 17, primary: 21, sheet: 27 } as const;
export const MOTION = { plate: 220, sheet: 280, ring: 300, pulse: 1600 } as const;
/** cubic-bezier(.2,.8,.2,1) */
export const EASE = [0.2, 0.8, 0.2, 1] as const;
export const SCREEN_PAD = 18;
export const TAP_MIN = 44;

export type ArchivoWeight = 400 | 500 | 600 | 700 | 800;
export const ARCHIVO: Record<ArchivoWeight, string> = {
  400: 'Archivo_400Regular',
  500: 'Archivo_500Medium',
  600: 'Archivo_600SemiBold',
  700: 'Archivo_700Bold',
  800: 'Archivo_800ExtraBold',
};

/** System UI font: SF on iOS. RN only accepts the 100–900 hundreds, so 650 → 600, 550 → 500, 750 → 700. */
export const sysWeight = (w: number): TextStyle['fontWeight'] => {
  const h = Math.max(100, Math.min(900, Math.round(w / 100) * 100));
  return String(h) as TextStyle['fontWeight'];
};

/** Numerals: Archivo with tabular figures. */
export const numStyle = (size: number, weight: ArchivoWeight = 700, letterSpacing = 0): TextStyle => ({
  fontFamily: ARCHIVO[weight],
  fontSize: size,
  letterSpacing,
  fontVariant: ['tabular-nums'],
  ...(Platform.OS === 'web' ? { fontFeatureSettings: '"tnum"' } as unknown as TextStyle : null),
});

export const useTheme = (): { t: Palette; dark: boolean; reduceMotion: boolean; c: (key: string) => string } => {
  const t = useTokens();
  const dark = useStore((s) => (s.theme === 'system' ? !!s.systemDark : s.theme === 'dark'));
  const reduceMotion = useStore((s) => s.reduceMotion);
  return { t, dark, reduceMotion, c: (key: string) => t[key] ?? key };
};
