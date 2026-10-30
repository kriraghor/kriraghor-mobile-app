import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { goToHub } from '@/lib/section-nav';

/**
 * The hub ↔ section "zoom-through", all on the UI thread (Reanimated timings; JS only hears when an
 * exit has finished, to change the route). Only transform and opacity animate.
 * - Into a section: the hub scales 1 → 1.08 and fades out (220 ms, ease-in), then the section's
 *   first screen enters from 0.92 to 1 while fading in (320 ms, ease-out, no overshoot).
 * - All sections: the section scales 1 → 0.94 and fades (200 ms, ease-in), then the hub enters from
 *   1.06 to 1.
 * - Reduce motion: plain 180 ms crossfades.
 * The stack itself does not animate these route changes (animation 'none'), so nothing fights it.
 */
export const ZOOM = {
  hubOut: { scale: 1.08, duration: 220 },
  sectionIn: { from: 0.92, duration: 320 },
  sectionOut: { scale: 0.94, duration: 200 },
  hubIn: { from: 1.06, duration: 320 },
  fade: 180,
} as const;

const easeIn = Easing.in(Easing.cubic);
const easeOut = Easing.out(Easing.cubic);

/**
 * A screen that enters from `from` scale and leaves to `to` scale. `leave(then)` plays the exit and
 * calls `then` on the JS thread when it has finished.
 */
export function useZoomScene(enterFrom: number, enterMs: number, exitTo: number, exitMs: number) {
  const reduce = useReducedMotion();
  const enter = useSharedValue(0);
  const exit = useSharedValue(0);

  useEffect(() => {
    enter.set(withTiming(1, { duration: reduce ? ZOOM.fade : enterMs, easing: easeOut }));
  }, [enter, reduce, enterMs]);

  const style = useAnimatedStyle(() => {
    const opacity = enter.value * (1 - exit.value);
    if (reduce) return { opacity };
    const scale = (enterFrom + (1 - enterFrom) * enter.value) * (1 + (exitTo - 1) * exit.value);
    return { opacity, transform: [{ scale }] };
  });

  const leave = useCallback(
    (then: () => void) => {
      exit.set(
        withTiming(1, { duration: reduce ? ZOOM.fade : exitMs, easing: easeIn }, (done) => {
          if (done) runOnJS(then)();
        })
      );
    },
    [exit, reduce, exitMs]
  );

  return { style, leave };
}

const LeaveToHub = createContext<(() => void) | null>(null);

/** All sections from anywhere inside a section: the section zooms out, then the hub zooms in. */
export function useLeaveToHub() {
  return useContext(LeaveToHub) ?? (() => void goToHub());
}

/** Wraps a section's tabs: they zoom in on arrival and out on the way back to the hub. */
export function SectionScene({ children }: { children: ReactNode }) {
  const { style, leave } = useZoomScene(ZOOM.sectionIn.from, ZOOM.sectionIn.duration, ZOOM.sectionOut.scale, ZOOM.sectionOut.duration);
  const toHub = useMemo(() => () => leave(() => void goToHub()), [leave]);
  return (
    <LeaveToHub.Provider value={toHub}>
      <Animated.View style={[styles.fill, style]}>{children}</Animated.View>
    </LeaveToHub.Provider>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
