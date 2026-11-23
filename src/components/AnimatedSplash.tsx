import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useColorScheme, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useTranslation } from 'react-i18next';
import { palette } from '@/constants/tokens';
import { withTypeface } from '@/constants/fonts';

/** The same size as the native splash image (app.config.ts imageWidth), so the hand-over is seamless. */
export const SPLASH_MARK = 96;

// The logo's pieces (the "K" of 23 Nov 2026): the stem, the orange strokes and the lower arm. The stem and
// the lower arm are black on light and white on dark.
const PIECES = [
  { key: 'stem', source: { light: require('../../assets/brand/logo-stem.png'), dark: require('../../assets/brand/logo-stem-dark.png') }, out: { x: -0.08, y: -0.34, r: -8 } },
  { key: 'upper', source: { light: require('../../assets/brand/logo-upper.png'), dark: require('../../assets/brand/logo-upper.png') }, out: { x: 0.34, y: -0.3, r: -18 } },
  { key: 'lower', source: { light: require('../../assets/brand/logo-lower.png'), dark: require('../../assets/brand/logo-lower-dark.png') }, out: { x: 0.34, y: 0.3, r: 18 } },
] as const;

/**
 * The app's loading animation (kriraghor-docs 09 §8): it starts exactly where the native splash
 * ends (the whole logo), the three pieces burst apart and spring back together and keep gently parting
 * and joining while the app loads. Under reduced motion it only fades.
 *
 * It never holds the app back (UI v2, 11 Nov 2026): the moment the app is ready the pieces settle, a ring
 * ripples and the screen fades, about EXIT_MS in all, whatever the burst was doing. A time limit ends it
 * even if no animation frame arrives (a hidden browser tab, a stalled device), so it cannot hang.
 */
export const EXIT_MS = 350;
/** After "ready", the longest the screen may stay if its animation never reports back. */
export const EXIT_LIMIT_MS = 900;

export function AnimatedSplash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const scheme = useColorScheme();
  const c = palette[scheme === 'dark' ? 'dark' : 'light'];
  const { t, i18n } = useTranslation();
  // Animated values live for the component's life (lazy state, not refs read during render).
  const [spread] = useState(() => new Animated.Value(0)); // 0 together, 1 apart
  const [ring] = useState(() => new Animated.Value(0));
  const [word] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(1));
  const [burstDone, setBurstDone] = useState(false);
  const [reduce, setReduce] = useState<boolean | null>(null);
  // Under reduced motion there is no burst: it counts as joined at once.
  const joined = burstDone || reduce === true;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce, () => setReduce(false));
  }, []);

  // 1. Burst apart and spring back together (once).
  useEffect(() => {
    if (reduce !== false) return;
    Animated.sequence([
      Animated.timing(spread, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(spread, { toValue: 0, friction: 5, tension: 70, useNativeDriver: true }),
    ]).start(() => setBurstDone(true));
  }, [reduce, spread]);

  // 2. Still loading: part a little and join, until ready.
  useEffect(() => {
    if (!joined || ready || reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(spread, { toValue: 0.35, duration: 520, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(spread, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [joined, ready, reduce, spread]);

  // 3. Ready: settle, ripple and fade out at once, without waiting for the burst to finish.
  useEffect(() => {
    if (!ready || reduce === null) return;
    let ended = false;
    const end = () => {
      if (ended) return;
      ended = true;
      onDone();
    };
    const settle = reduce ? 1 : 140;
    const finish = Animated.parallel([
      Animated.timing(spread, { toValue: 0, duration: settle, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(ring, { toValue: 1, duration: reduce ? 1 : EXIT_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(word, { toValue: 1, duration: reduce ? 1 : 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: reduce ? 180 : EXIT_MS - 120, delay: reduce ? 0 : 120, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]);
    finish.start(end);
    const limit = setTimeout(end, EXIT_LIMIT_MS);
    return () => {
      clearTimeout(limit);
      finish.stop();
    };
  }, [ready, reduce, spread, ring, word, fade, onDone]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: c.bg, opacity: fade }]}
      // The first frame is drawn: the native splash can go (same picture, same place).
      onLayout={() => void SplashScreen.hideAsync()}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={{ width: SPLASH_MARK, height: SPLASH_MARK }}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.ring,
            { borderColor: c.brand, opacity: ring.interpolate({ inputRange: [0, 0.05, 1], outputRange: [0, 0.55, 0] }), transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.6] }) }] },
          ]}
        />
        {PIECES.map((p) => (
          <Animated.Image
            key={p.key}
            source={p.source[scheme === 'dark' ? 'dark' : 'light']}
            style={[
              StyleSheet.absoluteFill,
              {
                width: SPLASH_MARK,
                height: SPLASH_MARK,
                transform: [
                  { translateX: spread.interpolate({ inputRange: [0, 1], outputRange: [0, p.out.x * SPLASH_MARK] }) },
                  { translateY: spread.interpolate({ inputRange: [0, 1], outputRange: [0, p.out.y * SPLASH_MARK] }) },
                  { rotate: spread.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.out.r}deg`] }) },
                ],
              },
            ]}
          />
        ))}
      </View>
      <Animated.Text
        style={[
          withTypeface({ fontSize: 26, fontWeight: '700', color: c.ink }, i18n.language),
          // Below the mark without moving it off the native splash's centre.
          styles.word,
          { opacity: word, transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] },
        ]}
      >
        {t('common.appName')}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  ring: { borderRadius: 9999, borderWidth: 2 },
  word: { position: 'absolute', top: '50%', marginTop: SPLASH_MARK / 2 + 18 },
});
