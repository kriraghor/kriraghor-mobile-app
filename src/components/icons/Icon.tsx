import { memo } from 'react';
import { Platform, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { GLYPH_GRID, GLYPHS, type Glyph, type IconName } from './glyphs';

export type { IconName } from './glyphs';

type Props = {
  name: IconName;
  /** 16 in dense rows, 20 beside text, 24 for tabs and tiles (the UI v2 icon rule). */
  size?: number;
  color: ColorValue;
  /** Kept so older call sites compile; the drawings are filled shapes and have no stroke to change. */
  strokeWidth?: number;
  /** Shows the solid drawing where the icon has one (a focused tab, a tile on a photo, a chosen star). */
  active?: boolean;
  /** Without a label the icon is decorative and hidden from screen readers. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * The app's icons (src/components/icons/glyphs.ts, generated from Phosphor Icons by scripts/build-glyphs.mjs):
 * the same family the websites use, as plain drawing data on react-native-svg, so no icon package is
 * bundled. An outline by default; the solid drawing when `active`.
 */
function IconBase({ name, size = 24, color, active = false, accessibilityLabel, style }: Props) {
  const glyph: Glyph = GLYPHS[name];
  const labelled = Boolean(accessibilityLabel);
  // The web build hands Svg props to the DOM, so it gets ARIA attributes instead of the native ones.
  const a11y =
    Platform.OS === 'web'
      ? ((labelled ? { role: 'img', 'aria-label': accessibilityLabel } : { 'aria-hidden': true }) as object)
      : { accessible: labelled, accessibilityLabel, accessibilityRole: labelled ? ('image' as const) : undefined, importantForAccessibility: labelled ? ('yes' as const) : ('no-hide-descendants' as const) };
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${GLYPH_GRID} ${GLYPH_GRID}`} style={style} {...a11y}>
      <Path d={active && glyph.f ? glyph.f : glyph.r} fill={color} />
    </Svg>
  );
}

export const Icon = memo(IconBase);
