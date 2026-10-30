import { memo } from 'react';
import { Platform, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { GLYPHS, type GlyphElement, type IconName } from './glyphs';

export type { IconName } from './glyphs';

type Props = {
  name: IconName;
  size?: number;
  color: ColorValue;
  strokeWidth?: number;
  /** Shows the duotone fill layer (a focused tab, a tile on a photo). */
  active?: boolean;
  /** Without a label the icon is decorative and hidden from screen readers. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

function element(el: GlyphElement, i: number, color: ColorValue, strokeWidth: number, active: boolean) {
  const stroke = { fill: 'none', stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  switch (el[0]) {
    case 'p':
      return <Path key={i} d={el[1]} {...stroke} />;
    case 'f':
      return active ? <Path key={i} d={el[1]} fill={color} fillOpacity={0.18} stroke="none" /> : null;
    case 'c':
      return <Circle key={i} cx={el[1]} cy={el[2]} r={el[3]} {...stroke} />;
    case 'd':
      return <Circle key={i} cx={el[1]} cy={el[2]} r={el[3]} fill={color} stroke="none" />;
    case 'r':
      return <Rect key={i} x={el[1]} y={el[2]} width={el[3]} height={el[4]} rx={el[5]} {...stroke} />;
  }
}

/** The app's own icon set (src/components/icons/glyphs.ts): 24 px grid, 1.75 stroke, round caps and joins. */
function IconBase({ name, size = 24, color, strokeWidth = 1.75, active = false, accessibilityLabel, style }: Props) {
  const glyph = GLYPHS[name] as readonly GlyphElement[];
  const labelled = Boolean(accessibilityLabel);
  // The web build hands Svg props to the DOM, so it gets ARIA attributes instead of the native ones.
  const a11y =
    Platform.OS === 'web'
      ? ((labelled ? { role: 'img', 'aria-label': accessibilityLabel } : { 'aria-hidden': true }) as object)
      : { accessible: labelled, accessibilityLabel, accessibilityRole: labelled ? ('image' as const) : undefined, importantForAccessibility: labelled ? ('yes' as const) : ('no-hide-descendants' as const) };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style} {...a11y}>
      {glyph.map((el, i) => element(el, i, color, strokeWidth, active))}
    </Svg>
  );
}

export const Icon = memo(IconBase);
