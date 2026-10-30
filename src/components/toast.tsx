import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/icons/Icon';
import { ThemedText } from '@/components/themed-text';
import { Duration, Radius } from '@/constants/motion';
import { useTheme } from '@/hooks/use-theme';

type Toast = { id: number; text: string };
const ToastCtx = createContext<(text: string) => void>(() => undefined);

/** `const toast = useToast(); toast('Request sent.')`: a short success line at the top. */
export const useToast = () => useContext(ToastCtx);

const SHOW_MS = 2600;

/**
 * Success toasts (a pass bought, a request sent): slide down and fade in at the top, stay 2.6 s, then
 * leave. Announced to screen readers (live region). Reduce motion: a fade only.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const seq = useRef(0);
  const show = useCallback((text: string) => setToast({ id: ++seq.current, text }), []);
  const value = useMemo(() => show, [show]);
  const gone = useCallback((id: number) => setToast((cur) => (cur?.id === id ? null : cur)), []);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      {toast ? <ToastView key={toast.id} id={toast.id} text={toast.text} onGone={gone} /> : null}
    </ToastCtx.Provider>
  );
}

function ToastView({ id, text, onGone }: { id: number; text: string; onGone: (id: number) => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(reduce ? withTiming(1, { duration: Duration.fade }) : withSpring(1, { damping: 20, stiffness: 240 }));
    // The timer only decides when to leave; the frames run on the UI thread.
    const hide = setTimeout(() => p.set(withTiming(0, { duration: Duration.micro })), SHOW_MS);
    const gone = setTimeout(() => onGone(id), SHOW_MS + Duration.micro + 50);
    return () => {
      clearTimeout(hide);
      clearTimeout(gone);
    };
  }, [p, reduce, onGone, id]);
  const style = useAnimatedStyle(() => (reduce ? { opacity: p.value } : { opacity: p.value, transform: [{ translateY: (1 - p.value) * -24 }] }));
  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 8 }]}>
      <Animated.View accessibilityLiveRegion="polite" accessibilityRole="alert" style={[styles.toast, { backgroundColor: theme.text }, style]}>
        <Icon name="check" size={20} color={theme.background} />
        <ThemedText type="smallBold" style={{ color: theme.background, flex: 1 }}>
          {text}
        </ThemedText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 100 },
  toast: { minHeight: 48, maxWidth: 480, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderRadius: Radius.control },
});
