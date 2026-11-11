import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { requireOptionalNativeModule } from 'expo';
import { useEffect, useId, useState, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useScheme } from '@/hooks/theme-scope';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { withTypeface } from '@/constants/fonts';
import { Duration } from '@/constants/motion';
import { TAB_BAR_GAP, TAB_BAR_HEIGHT } from '@/hooks/use-tab-bar-inset';
import { useTheme } from '@/hooks/use-theme';
import { tabIndicator } from '@/lib/ui-logic';

const RADIUS = 24;
const PAD = 6;
const SLIDE = { damping: 22, stiffness: 260, mass: 0.8 } as const;

/**
 * iOS Liquid Glass, only when the native module is in the installed binary: an OTA bundle on an
 * older build must never touch a module it lacks, so the package is required lazily behind
 * requireOptionalNativeModule and a try/catch. Everything else gets the frosted approximation.
 */
type GlassComponent = ComponentType<{ style?: ViewStyle; glassEffectStyle?: 'regular' | 'clear' }>;
function nativeGlass(): GlassComponent | null {
  if (Platform.OS !== 'ios') return null;
  try {
    if (!requireOptionalNativeModule('ExpoGlassEffect')) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-glass-effect') as { isLiquidGlassAvailable: () => boolean; GlassView: GlassComponent };
    return mod.isLiquidGlassAvailable() ? mod.GlassView : null;
  } catch {
    return null;
  }
}
/** Decided once when the module loads. */
const NativeGlass = nativeGlass();

/** "#RRGGBB" at an opacity. */
const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/**
 * The glass surface. iOS 26: the real GlassView. Android and the web: an approximation (no real blur
 * without expo-blur, which would need a new native build): the theme surface at 82% opacity, a 1 px
 * highlight fading down from the top edge, and a hairline border. The web build adds a CSS backdrop
 * blur.
 */
function GlassSurface() {
  const theme = useTheme();
  const dark = useScheme() === 'dark';
  const id = `hl-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  if (NativeGlass) return <NativeGlass style={StyleSheet.absoluteFill} glassEffectStyle="regular" />;
  const web = Platform.OS === 'web' ? ({ backdropFilter: 'blur(18px) saturate(160%)' } as unknown as ViewStyle) : null;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: alpha(theme.backgroundElement, 0.82) }, web]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none" pointerEvents="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={dark ? 0.12 : 0.6} />
            <Stop offset="0.4" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="1" height="1" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/**
 * The floating glass tab bar shared by the Esports and Gym sections: inset 12 from the sides and
 * 8 above the safe area, radius 24, a hairline border and a soft tinted shadow. A pill slides behind
 * the active tab on a spring; the active icon shows its duotone fill in the brand colour and settles
 * at 1.08; labels crossfade between the two colours. Labels always show; 48 dp targets.
 */
export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const dark = useScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const [width, setWidth] = useState(0);
  const count = state.routes.length;
  const target = tabIndicator(state.index, count, width, PAD);
  const x = useSharedValue(target.x);

  useEffect(() => {
    if (!width) return;
    x.set(reduce ? withTiming(target.x, { duration: Duration.fade }) : withSpring(target.x, SLIDE));
  }, [target.x, width, reduce, x]);

  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          bottom: TAB_BAR_GAP + insets.bottom,
          borderColor: dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.08)',
          shadowColor: theme.brand,
        },
      ]}>
      <View style={styles.clip} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="tablist">
        <GlassSurface />
        {width ? <Animated.View style={[styles.pill, { width: target.width, backgroundColor: alpha(theme.brand, dark ? 0.22 : 0.12) }, pill]} /> : null}
        {state.routes.map((route, i) => {
          const { options } = descriptors[route.key];
          const focused = state.index === i;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          return (
            <TabItem
              key={route.key}
              label={label}
              focused={focused}
              badge={options.tabBarBadge}
              renderIcon={(color) => options.tabBarIcon?.({ focused, color, size: 24 })}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            />
          );
        })}
      </View>
    </View>
  );
}

function TabItem({ label, focused, badge, renderIcon, onPress, onLongPress }: { label: string; focused: boolean; badge?: string | number; renderIcon: (color: string) => React.ReactNode; onPress: () => void; onLongPress: () => void }) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  const reduce = useReducedMotion();
  const on = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    on.set(withTiming(focused ? 1 : 0, { duration: Duration.micro }));
  }, [focused, on]);
  const scale = useAnimatedStyle(() => (reduce ? {} : { transform: [{ scale: 1 + 0.08 * on.value }] }));
  const activeLabel = useAnimatedStyle(() => ({ opacity: on.value }));
  const idleLabel = useAnimatedStyle(() => ({ opacity: 1 - on.value }));
  const text = withTypeface({ fontSize: 12, lineHeight: 16, fontWeight: '600' }, i18n.language);
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.item}>
      <Animated.View style={scale}>
        {renderIcon(focused ? theme.brand : theme.textSecondary)}
        {badge ? (
          <View style={[styles.badge, { backgroundColor: theme.accent, borderColor: theme.backgroundElement }]}>
            <Text style={[styles.badgeText, { color: theme.onAccent }]}>{badge}</Text>
          </View>
        ) : null}
      </Animated.View>
      <View>
        <Animated.Text numberOfLines={1} style={[text, { color: theme.textSecondary }, idleLabel]}>
          {label}
        </Animated.Text>
        <Animated.Text numberOfLines={1} style={[text, styles.overlay, { color: theme.brandText }, activeLabel]}>
          {label}
        </Animated.Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: TAB_BAR_HEIGHT,
    borderRadius: RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  clip: { flex: 1, borderRadius: RADIUS, overflow: 'hidden', flexDirection: 'row', paddingHorizontal: PAD },
  pill: { position: 'absolute', left: 0, top: PAD, bottom: PAD, borderRadius: RADIUS - PAD },
  item: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 2 },
  overlay: { position: 'absolute', left: 0, right: 0, top: 0, textAlign: 'center' },
  badge: { position: 'absolute', top: -5, right: -12, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 12, lineHeight: 14, fontWeight: '700' },
});
