import { Icon, type IconName } from '@/components/icons/Icon';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View, type PressableProps, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { Duration, ENTER_OFFSET, PRESS_SCALE, Radius, Springs } from '@/constants/motion';
import { staggerDelay } from '@/lib/motion';
import { withTypeface } from '@/constants/fonts';
import { useTheme } from '@/hooks/use-theme';

type FieldProps = TextInputProps & {
  label: string;
  /** Marks the field as wrong (red border) without a text of its own. */
  error?: string | null;
  /** A line under the field: what to type, or a check result. */
  hint?: string | null;
  /** Green for a good check result (a username that is free). */
  hintTone?: 'muted' | 'good';
  /** What is wrong, under the field in red (replaces the hint, read out by screen readers). */
  errorText?: string | null;
  /** Something inside the box on the right (the show/hide password button). */
  right?: ReactNode;
};

/** Form primitives on the Kriraghor tokens: 48px targets, labels above, errors below, Radius.control corners. */
export function Field({ label, error, hint, hintTone = 'muted', errorText, right, style, ...input }: FieldProps) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  const invalid = Boolean(error || errorText);
  const box = { borderColor: invalid ? theme.danger : theme.line, backgroundColor: theme.backgroundElement };
  const text = withTypeface(StyleSheet.flatten([styles.input, right ? styles.inputInRow : null, { color: theme.text }, right ? null : box, style]), i18n.language);
  const below = errorText || hint;
  const textInput = <TextInput accessibilityLabel={label} accessibilityHint={below ?? undefined} placeholderTextColor={theme.textSecondary} style={text} {...input} />;
  return (
    <View style={styles.field}>
      <Text style={withTypeface(StyleSheet.flatten([styles.label, { color: theme.textSecondary }]), i18n.language)}>{label}</Text>
      {right ? (
        <View style={[styles.inputRow, box]}>
          {textInput}
          {right}
        </View>
      ) : (
        textInput
      )}
      {below ? (
        <Text
          accessibilityLiveRegion={errorText ? 'polite' : 'none'}
          style={withTypeface(StyleSheet.flatten([styles.below, { color: errorText ? theme.danger : hintTone === 'good' ? theme.brandText : theme.textSecondary }]), i18n.language)}>
          {below}
        </Text>
      ) : null}
    </View>
  );
}

/** A password with a show/hide button (48px, labelled for screen readers). */
export function PasswordField({ showLabel, hideLabel, ...field }: Omit<FieldProps, 'secureTextEntry' | 'right'> & { showLabel: string; hideLabel: string }) {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  return (
    <Field
      autoCapitalize="none"
      autoCorrect={false}
      spellCheck={false}
      {...field}
      secureTextEntry={!visible}
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? hideLabel : showLabel}
          accessibilityState={{ checked: visible }}
          onPress={() => setVisible((v) => !v)}
          hitSlop={4}
          style={({ pressed }) => [styles.eye, pressed && { opacity: 0.7 }]}>
          <Icon name={visible ? 'eye-off' : 'eye'} size={22} color={theme.textSecondary} />
        </Pressable>
      }
    />
  );
}

/**
 * Six boxes for a one-time code, driven by one hidden text field, so the phone's SMS autofill
 * (iOS oneTimeCode, Android sms-otp) and paste fill all six at once. `onComplete` fires when the
 * sixth digit arrives.
 */
export function CodeInput({ label, value, onChange, onComplete, errorText, autoFocus, editable = true }: { label: string; value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; errorText?: string | null; autoFocus?: boolean; editable?: boolean }) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const digits = value.replace(/\D/g, '').slice(0, 6);
  const change = (raw: string) => {
    const v = raw.replace(/\D/g, '').slice(0, 6);
    onChange(v);
    if (v.length === 6 && v !== digits) onComplete?.(v);
  };
  return (
    <View style={styles.field}>
      <Text style={withTypeface(StyleSheet.flatten([styles.label, { color: theme.textSecondary }]), i18n.language)}>{label}</Text>
      <Pressable accessible={false} onPress={() => ref.current?.focus()} style={styles.codeRow}>
        {Array.from({ length: 6 }, (_, i) => {
          const active = focused && (i === digits.length || (digits.length === 6 && i === 5));
          return (
            <View
              key={i}
              style={[
                styles.codeBox,
                { backgroundColor: theme.backgroundElement, borderColor: errorText ? theme.danger : active ? theme.brand : theme.line },
              ]}>
              <Text style={withTypeface(StyleSheet.flatten([styles.codeDigit, { color: theme.text }]), i18n.language)}>{digits[i] ?? ''}</Text>
            </View>
          );
        })}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={errorText ?? undefined}
          value={digits}
          onChangeText={change}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="number-pad"
          inputMode="numeric"
          textContentType="oneTimeCode"
          autoComplete={Platform.OS === 'ios' ? 'one-time-code' : 'sms-otp'}
          maxLength={6}
          autoFocus={autoFocus}
          editable={editable}
          caretHidden
          contextMenuHidden={false}
          style={styles.codeHidden}
        />
      </Pressable>
      {errorText ? (
        <Text accessibilityLiveRegion="polite" style={withTypeface(StyleSheet.flatten([styles.below, { color: theme.danger }]), i18n.language)}>
          {errorText}
        </Text>
      ) : null}
    </View>
  );
}

/** A text button for secondary actions (Forgot password?, Change, Resend): 48px tall, brand coloured. */
export function TextLink({ title, onPress, disabled, align = 'left', tone = 'brand' }: { title: string; onPress: () => void; disabled?: boolean; align?: 'left' | 'center'; tone?: 'brand' | 'text' }) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.link, align === 'center' && { alignSelf: 'center' }, pressed && { opacity: 0.7 }, disabled && { opacity: 0.5 }]}>
      <Text style={withTypeface(StyleSheet.flatten([styles.linkText, { color: tone === 'brand' ? theme.brandText : theme.text }]), i18n.language)}>{title}</Text>
    </Pressable>
  );
}

const APressable = Animated.createAnimatedComponent(Pressable);

/**
 * The one pressable for cards, rows, tiles and buttons: it shrinks to 0.97 on a spring while held
 * (feedback), and with reduce motion on it dims a little instead. `style` must be a plain style, not
 * a function of the pressed state.
 */
export function AnimatedPressable({ style, onPressIn, onPressOut, disabled, children, ...rest }: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const dim = useSharedValue(1);
  // Opacity is animated only with reduce motion on, so a disabled button keeps its own dimming.
  const animated = useAnimatedStyle(() => (reduce ? { opacity: dim.value } : { transform: [{ scale: scale.value }] }));
  return (
    <APressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        if (reduce) dim.set(withTiming(0.85, { duration: Duration.micro }));
        else scale.set(withSpring(PRESS_SCALE, Springs.press));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (reduce) dim.set(withTiming(1, { duration: Duration.micro }));
        else scale.set(withSpring(1, Springs.press));
        onPressOut?.(e);
      }}
      style={[style, animated]}>
      {children}
    </APressable>
  );
}

/**
 * Fades a card or list item in, rising 12 points, 40 ms after the one before (reduce motion: none).
 * Not on the web build (previews only): Reanimated's web entering animations take items out of the
 * layout while they run, so lists there render without them.
 */
export function Reveal({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  if (Platform.OS === 'web') return <View style={style}>{children}</View>;
  return (
    <Animated.View entering={FadeInDown.delay(staggerDelay(index)).duration(Duration.enter).withInitialValues({ opacity: 0, transform: [{ translateY: ENTER_OFFSET }] })} style={style}>
      {children}
    </Animated.View>
  );
}

/** A grey block that gently pulses while a list loads (stops once the content arrives; still with reduce motion). */
export function Skeleton({ height = 16, width = '100%', radius = Radius.control, style }: { height?: number; width?: number | `${number}%`; radius?: number; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const reduce = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!reduce) pulse.set(withRepeat(withTiming(0.45, { duration: 700 }), -1, true));
  }, [reduce, pulse]);
  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View accessible={false} style={[{ height, width, borderRadius: radius, backgroundColor: theme.backgroundSelected }, animated, style]} />;
}

/** A loading list: a few card-shaped skeletons, labelled for screen readers. */
export function SkeletonList({ rows = 3, height = 120, label }: { rows?: number; height?: number; label: string }) {
  return (
    <View accessible accessibilityLabel={label} accessibilityRole="progressbar" style={{ gap: 12, padding: 16 }}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={height} radius={Radius.card} />
      ))}
    </View>
  );
}

export function Button({ title, onPress, busy, disabled, variant = 'primary' }: { title: string; onPress: () => void; busy?: boolean; disabled?: boolean; variant?: 'primary' | 'outline' }) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  const primary = variant === 'primary';
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ busy: !!busy, disabled: !!busy || !!disabled }}
      disabled={busy || disabled}
      onPress={onPress}
      style={[styles.button, primary ? { backgroundColor: theme.brand } : { borderWidth: 2, borderColor: theme.text }, disabled && !busy ? { opacity: 0.5 } : null]}>
      {busy ? <ActivityIndicator color={primary ? theme.onBrand : theme.text} /> : <Text style={withTypeface(StyleSheet.flatten([styles.buttonText, { color: primary ? theme.onBrand : theme.text }]), i18n.language)}>{title}</Text>}
    </AnimatedPressable>
  );
}

export function Notice({ text, tone = 'info' }: { text: string; tone?: 'info' | 'error' }) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={withTypeface(StyleSheet.flatten([styles.notice, { backgroundColor: theme.backgroundElement, borderLeftColor: tone === 'error' ? theme.danger : theme.brand, color: tone === 'error' ? theme.danger : theme.text }]), i18n.language)}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  field: { gap: 4 },
  label: { fontSize: 14, fontWeight: '600' },
  input: { minHeight: 48, borderWidth: 2, borderRadius: Radius.control, paddingHorizontal: 12, fontSize: 16 },
  inputInRow: { flex: 1, borderWidth: 0, borderRadius: 0, minHeight: 44 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderRadius: Radius.control, minHeight: 48, overflow: 'hidden' },
  below: { fontSize: 13, lineHeight: 19 },
  eye: { width: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
  codeRow: { flexDirection: 'row', gap: 8 },
  codeBox: { flex: 1, height: 56, borderWidth: 2, borderRadius: Radius.control, alignItems: 'center', justifyContent: 'center' },
  codeDigit: { fontSize: 24, lineHeight: 32, fontWeight: '700' },
  codeHidden: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02, color: 'transparent', fontSize: 1 },
  link: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 4 },
  linkText: { fontSize: 15, fontWeight: '700' },
  button: { minHeight: 48, borderRadius: Radius.control, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  buttonText: { fontSize: 16, fontWeight: '700' },
  notice: { borderLeftWidth: 4, borderRadius: Radius.control, overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, lineHeight: 20 },
});

/** A screen with nothing to show yet: an icon, a short line and, when it helps, one action. */
export function EmptyState({ text, action, icon }: { text: string; action?: { title: string; onPress: () => void }; icon?: IconName }) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  return (
    <View style={[emptyStyles.empty, { backgroundColor: theme.background }]}>
      {icon ? (
        <View style={[emptyStyles.icon, { backgroundColor: theme.backgroundSelected }]}>
          <Icon name={icon} size={28} color={theme.textSecondary} />
        </View>
      ) : null}
      <Text style={withTypeface(StyleSheet.flatten([emptyStyles.emptyText, { color: theme.textSecondary }]), i18n.language)}>{text}</Text>
      {action ? <Button title={action.title} onPress={action.onPress} /> : null}
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  empty: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
  icon: { width: 56, height: 56, borderRadius: Radius.control, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  emptyText: { fontSize: 16, lineHeight: 24, fontWeight: '500', textAlign: 'center' },
});
