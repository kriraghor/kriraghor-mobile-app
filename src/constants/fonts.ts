import {
  HindSiliguri_400Regular,
  HindSiliguri_500Medium,
  HindSiliguri_600SemiBold,
  HindSiliguri_700Bold,
} from '@expo-google-fonts/hind-siliguri';
import { StyleSheet, type TextStyle } from 'react-native';

/** Loaded once at launch (root layout). English uses the system font; Bangla uses Hind Siliguri. */
export const FONT_ASSETS = { HindSiliguri_400Regular, HindSiliguri_500Medium, HindSiliguri_600SemiBold, HindSiliguri_700Bold };

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
