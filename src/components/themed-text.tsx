import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { displayFace, withTypeface } from '@/constants/fonts';
import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  /**
   * `display` and `heading` are the heading face (UI v2): a screen's one big line, and a section's title.
   * `eyebrow` is the small capital line above a heading.
   */
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code' | 'display' | 'heading' | 'eyebrow';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const { i18n } = useTranslation();

  return (
    <Text
      style={withTypeface(StyleSheet.flatten([
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && [styles.linkPrimary, { color: theme.brandText }],
        type === 'code' && styles.code,
        type === 'display' && styles.display,
        type === 'heading' && styles.heading,
        type === 'eyebrow' && [styles.eyebrow, { color: themeColor ? theme[themeColor] : theme.accentText }],
        style,
      ]), i18n.language)}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  title: {
    fontSize: 48,
    fontWeight: 600,
    lineHeight: 52,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontWeight: 600,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
  },
  display: { ...displayFace, fontSize: 34, lineHeight: 40 },
  heading: { ...displayFace, fontSize: 22, lineHeight: 28 },
  eyebrow: { fontSize: 12, lineHeight: 16, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
