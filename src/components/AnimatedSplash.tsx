import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useColorScheme, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useTranslation } from 'react-i18next';
import { palette } from '@/constants/tokens';
import { withTypeface } from '@/constants/fonts';

/** The same size as the native splash image (app.config.ts imageWidth), so the hand-over is seamless. */
export const SPLASH_MARK = 96;

const PIECES = [
  { key: 'cricket', source: require('../../assets/brand/logo-cricket.png'), out: { x: -0.32, y: -0.32, r: -22 } },
  { key: 'esports', source: require('../../assets/brand/logo-esports.png'), out: { x: -0.3, y: 0.34, r: 18 } },
  { key: 'football', source: require('../../assets/brand/logo-football.png'), out: { x: 0.38, y: -0.04, r: 26 } },
] as const;

/**
 * The app's loading animation (kriraghor-docs 09 §8): it starts exactly where the native splash
 * ends (the whole logo), the three pieces burst apart and spring back together from their three
 * sides, keep gently parting and joining while the app loads, then a ring ripples, the wordmark
 * rises and it fades into the app. Under reduced motion it only fades.
 */
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

  // 3. Ready: settle, ripple, wordmark, fade out.
  useEffect(() => {
    if (!joined || !ready) return;
    const finish = Animated.sequence([
      Animated.parallel([
        Animated.timing(spread, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(ring, { toValue: 1, duration: reduce ? 1 : 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(word, { toValue: 1, duration: reduce ? 1 : 420, delay: reduce ? 0 : 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.delay(reduce ? 0 : 260),
      Animated.timing(fade, { toValue: 0, duration: 280, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]);
    finish.start(({ finished }) => finished && onDone());
    return () => finish.stop();
  }, [joined, ready, reduce, spread, ring, word, fade, onDone]);

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
            source={p.source}
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
