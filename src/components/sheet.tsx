import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { Duration, Radius } from '@/constants/motion';
import { useTheme } from '@/hooks/use-theme';
import { sheetDrag, sheetMounted, sheetPhase, sheetShouldDismiss, type SheetPhase } from '@/lib/ui-logic';
import { displayFace } from '@/constants/fonts';

const OPEN_SPRING = { damping: 26, stiffness: 260, mass: 0.9, overshootClamping: true } as const;

/**
 * A bottom sheet (drawer) for long option lists: a 50% black scrim fades in, the sheet springs up
 * from the bottom, a drag down on the handle or header dismisses it (fast fling or past a third of
 * its height), as do the scrim, the Android back button and Escape on the web. It is modal for screen
 * readers and labelled by its title. Reduce motion: plain fades. Transform and opacity only.
 */
export function Sheet({ visible, onClose, title, children, footer }: { visible: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<SheetPhase>(visible ? 'opening' : 'closed');
  const [sheetH, setSheetH] = useState(screenH);
  const y = useSharedValue(screenH);
  const scrim = useSharedValue(0);

  // Follow `visible` (render-time state adjustment, no effect needed for the phase itself).
  const [seen, setSeen] = useState(visible);
  if (seen !== visible) {
    setSeen(visible);
    setPhase((p) => sheetPhase(p, visible ? 'show' : 'hide'));
  }

  useEffect(() => {
    const opened = () => setPhase((p) => sheetPhase(p, 'opened'));
    const closed = () => setPhase((p) => sheetPhase(p, 'closed'));
    if (phase === 'opening') {
      scrim.set(withTiming(1, { duration: Duration.micro }));
      if (reduce) {
        y.set(0);
        opened();
      } else
        y.set(
          withSpring(0, OPEN_SPRING, (done) => {
            if (done) runOnJS(opened)();
          })
        );
    } else if (phase === 'closing') {
      scrim.set(withTiming(0, { duration: Duration.micro }));
      y.set(
        withTiming(reduce ? 0 : sheetH, { duration: reduce ? Duration.fade : 220, easing: Easing.in(Easing.cubic) }, (done) => {
          if (done) runOnJS(closed)();
        })
      );
    }
  }, [phase, reduce, sheetH, scrim, y]);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      y.set(sheetDrag(e.translationY));
    })
    .onEnd((e) => {
      if (sheetShouldDismiss(e.translationY, e.velocityY, sheetH)) runOnJS(onClose)();
      else y.set(withSpring(0, OPEN_SPRING));
    });

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value * 0.5 }));
  const sheetStyle = useAnimatedStyle(() => (reduce ? { opacity: scrim.value } : { transform: [{ translateY: y.value }] }));

  useEffect(() => {
    if (Platform.OS !== 'web' || !sheetMounted(phase)) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    globalThis.addEventListener?.('keydown', onKey);
    return () => globalThis.removeEventListener?.('keydown', onKey);
  }, [phase, onClose]);

  if (!sheetMounted(phase)) return null;
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.fill}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}>
          <Pressable style={styles.fill} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('sheet.close')} />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          accessibilityLabel={title}
          onLayout={(e) => setSheetH(e.nativeEvent.layout.height)}
          style={[styles.sheet, { backgroundColor: theme.background, maxHeight: screenH - insets.top - 24 }, sheetStyle]}>
          <GestureDetector gesture={pan}>
            <View style={styles.head}>
              <View style={[styles.handle, { backgroundColor: theme.line }]} />
              <View style={styles.titleRow}>
                <ThemedText style={styles.title} accessibilityRole="header">
                  {title}
                </ThemedText>
                <Pressable accessibilityRole="button" accessibilityLabel={t('sheet.close')} onPress={onClose} hitSlop={8} style={styles.close}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    {t('sheet.done')}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </GestureDetector>
          <Animated.ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
            {children}
          </Animated.ScrollView>
          {footer ? <View style={[styles.footer, { borderTopColor: theme.line, paddingBottom: 12 + insets.bottom }]}>{footer}</View> : <View style={{ height: insets.bottom }} />}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** Options as a wrapped grid of chips (never a sideways scroller that clips), one selected. */
export function ChoiceChips({ items, value, onChange, label }: { items: { key: string; label: string }[]; value: string; onChange: (key: string) => void; label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable
            key={it.key || 'any'}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(it.key)}
            style={[styles.chip, { borderColor: on ? theme.brand : theme.line, backgroundColor: on ? theme.brand : theme.backgroundElement }]}>
            <ThemedText type="smallBold" style={{ color: on ? theme.onBrand : theme.text }}>
              {it.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A labelled group inside a sheet. */
export function SheetSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrim: { backgroundColor: '#000' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: Radius.card + 4, borderTopRightRadius: Radius.card + 4, overflow: 'hidden' },
  head: { paddingTop: 8, paddingHorizontal: 16 },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  title: { ...displayFace, flex: 1, fontSize: 20, lineHeight: 28 },
  close: { minHeight: 48, minWidth: 48, alignItems: 'flex-end', justifyContent: 'center' },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { paddingHorizontal: 16, paddingBottom: 16, gap: 24 },
  section: { gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 48, paddingHorizontal: 16, borderRadius: Radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
});
