import { Platform } from 'react-native';
import { paletteV2 } from './tokens';

/**
 * The app's colours, taken from the shared tokens (UI v2 "Floodlight", 11 Nov 2026), so the app and the
 * websites cannot drift apart: `tokens.ts` is a copy of kriraghor-frontend packages/tokens (npm run
 * tokens:copy there), and this file only gives its values the names the screens already use.
 *
 * Green is every action. The logo's orange (`accent`, and `prize` for money won) is energy: live,
 * prizes, highlights. Text on green is `onBrand` and on orange `onAccent`; never a fixed white, because
 * in the dark theme both colours are bright and take dark text.
 */
const named = (p: (typeof paletteV2)['light'] | (typeof paletteV2)['dark']) => ({
  text: p.ink,
  textSecondary: p.muted,
  background: p.bg,
  backgroundElement: p.surface,
  backgroundSelected: p.surface2,
  line: p.line,
  lineStrong: p.lineStrong,
  brand: p.brand,
  brandSoft: p.brandSoft,
  brandText: p.brandText,
  onBrand: p.onBrand,
  accent: p.accent,
  accentSoft: p.accentSoft,
  accentText: p.accentText,
  onAccent: p.onAccent,
  prize: p.prize,
  prizeText: p.prizeText,
  band: p.band,
  bandText: p.bandText,
  live: p.live,
  danger: p.danger,
  dangerSoft: p.dangerSoft,
  info: p.info,
  warning: p.warning,
});

export const Colors = { light: named(paletteV2.light), dark: named(paletteV2.dark) } as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', mono: 'ui-monospace' },
  default: { sans: 'normal', mono: 'monospace' },
});

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
