import {
  HindSiliguri_400Regular,
  HindSiliguri_500Medium,
  HindSiliguri_600SemiBold,
  HindSiliguri_700Bold,
} from '@expo-google-fonts/hind-siliguri';
import { AnekBangla_800ExtraBold } from '@expo-google-fonts/anek-bangla';
import { StyleSheet, type TextStyle } from 'react-native';

/**
 * Loaded once at launch (root layout). Text: English uses the system font, Bangla uses Hind Siliguri.
 * Headings (UI v2): one weight of Anek Bangla, which draws both Bangla and English, so a heading looks the
 * same in either language and matches the websites' display font. One file, about 250 KB.
 */
export const FONT_ASSETS = { HindSiliguri_400Regular, HindSiliguri_500Medium, HindSiliguri_600SemiBold, HindSiliguri_700Bold, AnekBangla_800ExtraBold };

/** The heading face. A style that names it keeps it in both languages (withTypeface leaves a set family alone). */
export const DISPLAY_FONT = 'AnekBangla_800ExtraBold';
/** Spread into a text style to make it a heading: the display face at its own weight. */
export const displayFace = { fontFamily: DISPLAY_FONT, fontWeight: 'normal' } as const;

const BN_FAMILY: Record<string, string> = {
  '100': 'HindSiliguri_400Regular',
  '200': 'HindSiliguri_400Regular',
  '300': 'HindSiliguri_400Regular',
  '400': 'HindSiliguri_400Regular',
  normal: 'HindSiliguri_400Regular',
  '500': 'HindSiliguri_500Medium',
  '600': 'HindSiliguri_600SemiBold',
  '700': 'HindSiliguri_700Bold',
  bold: 'HindSiliguri_700Bold',
  '800': 'HindSiliguri_700Bold',
  '900': 'HindSiliguri_700Bold',
};

/**
 * For Bangla, replace the weight with the matching Hind Siliguri face (a custom font on Android
 * ignores fontWeight). A monospace style keeps its own font. English styles pass through.
 */
export function withTypeface(style: TextStyle | undefined, language: string): TextStyle | undefined {
  if (language !== 'bn') return style;
  const flat = StyleSheet.flatten(style) ?? {};
  if (flat.fontFamily) return style;
  const family = BN_FAMILY[String(flat.fontWeight ?? '400')] ?? BN_FAMILY['400'];
  return { ...flat, fontFamily: family, fontWeight: undefined };
}
