/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useScheme } from '@/hooks/theme-scope';

/** The colours to draw with here: the enclosing ThemeScope's (the Esports section is dark), else the phone's. */
export function useTheme() {
  return Colors[useScheme()];
}
