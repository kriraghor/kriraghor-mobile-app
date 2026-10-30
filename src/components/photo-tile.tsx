import { Icon, type IconName } from '@/components/icons/Icon';
import { Image } from 'expo-image';
import { useEffect, useId } from 'react';
import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { ThemedText } from '@/components/themed-text';
import { Duration, Radius } from '@/constants/motion';
import { lerpZoom, zoomFrom, type Rect as Box } from '@/lib/motion';


/**
 * A black gradient over a photo (30% at the top for the icon badge), weighted to the bottom where the
 * text sits: 85% black there, so white text stays above 4.5:1 on any photo.
 */
export function PhotoTint({ strength = 1 }: { strength?: number }) {
  const id = `tint-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none" pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity={0.3 * strength} />
          <Stop offset="0.45" stopColor="#000" stopOpacity={0.4 * strength} />
          <Stop offset="1" stopColor="#000" stopOpacity={Math.min(0.9, 0.85 * strength)} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="1" height="1" fill={`url(#${id})`} />
    </Svg>
  );
}

/** What a hub tile shows: the photo, the tint, an icon, the name and one short line (white). */
export function TileFace({ photo, icon, title, body, web, big }: { photo: number; icon: IconName; title: string; body: string; web?: boolean; big?: boolean }) {
  return (
    <>
      <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} accessible={false} />
      <PhotoTint />
      <View style={styles.top}>
        <View style={styles.iconChip}>
          <Icon name={icon} size={24} color="#FFFFFF" active />
        </View>
        {web ? <Icon name="external" size={18} color="#FFFFFF" /> : null}
      </View>
      <View style={styles.text}>
        <ThemedText style={[big ? styles.titleBig : styles.title, styles.white]}>{title}</ThemedText>
        <ThemedText type="small" style={[styles.white, styles.body]} numberOfLines={2}>
          {body}
        </ThemedText>
      </View>
    </>
  );
}

/**
 * The hub's zoom: a full-screen copy of the tapped tile that grows from the tile's measured rect to
 * the whole screen (transform only, 350 ms, eased like a critically damped spring), then calls
 * `onIn`. Setting `out` plays it backwards and calls `onOut`. With reduce motion it is a plain
 * crossfade.
 */
export function ZoomOverlay({ rect, out, onIn, onOut, children }: { rect: Box; out?: boolean; onIn: () => void; onOut: () => void; children: React.ReactNode }) {
  const screen = useWindowDimensions();
  const reduce = useReducedMotion();
  const p = useSharedValue(0);
  const from = zoomFrom(rect, screen);

  useEffect(() => {
    const target = out ? 0 : 1;
    const duration = reduce ? Duration.fade : Duration.zoom;
    // Once per direction: from the animation's end, or from a timer if frames are not running (a
    // backgrounded web tab), so the person is never left on the hub with nothing happening.
    let called = false;
    const done = () => {
      if (called) return;
      called = true;
      (out ? onOut : onIn)();
    };
    p.set(
      withTiming(target, { duration, easing: Easing.bezier(0.2, 0.9, 0.25, 1) }, (finished) => {
        if (finished) runOnJS(done)();
      })
    );
    const timer = setTimeout(done, duration + 300);
    return () => clearTimeout(timer);
  }, [out, reduce, p, onIn, onOut]);

  const style = useAnimatedStyle(() => {
    if (reduce) return { opacity: p.value };
    const z = lerpZoom(from, p.value);
    return {
      opacity: Math.min(1, p.value * 4),
      transform: [{ translateX: z.translateX }, { translateY: z.translateY }, { scaleX: z.scaleX }, { scaleY: z.scaleY }],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.overlay, style]}>
      {children}
    </Animated.View>
  );
}

export const tileStyle: StyleProp<ViewStyle> = { borderRadius: Radius.card, overflow: 'hidden', justifyContent: 'space-between', padding: 16 };

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  iconChip: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  text: { gap: 2 },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '800' },
  titleBig: { fontSize: 28, lineHeight: 36, fontWeight: '800' },
  white: { color: '#FFFFFF' },
  body: { opacity: 0.92 },
  overlay: { zIndex: 10, overflow: 'hidden', justifyContent: 'space-between', padding: 24, paddingTop: 64 },
});
