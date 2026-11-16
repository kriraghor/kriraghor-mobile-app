import { Icon, type IconName } from '@/components/icons/Icon';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View, type PressableProps, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { Duration, ENTER_OFFSET, PRESS_SCALE, Radius, Springs } from '@/constants/motion';
import { countStep, staggerDelay } from '@/lib/motion';
import { displayFace, withTypeface } from '@/constants/fonts';
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
  // The edge answers the finger: green while the field has the cursor, red when it is wrong.
  const [focused, setFocused] = useState(false);
  const box = { borderColor: invalid ? theme.danger : focused ? theme.brand : theme.lineStrong, backgroundColor: theme.backgroundElement };
  const text = withTypeface(StyleSheet.flatten([styles.input, right ? styles.inputInRow : null, { color: theme.text }, right ? null : box, style]), i18n.language);
  const below = errorText || hint;
  const textInput = (
    <TextInput
      accessibilityLabel={label}
      accessibilityHint={below ?? undefined}
      placeholderTextColor={theme.textSecondary}
      style={text}
      {...input}
      onFocus={(e) => {
        setFocused(true);
        input.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        input.onBlur?.(e);
      }}
    />
  );
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
                { backgroundColor: theme.backgroundElement, borderColor: errorText ? theme.danger : active ? theme.brand : theme.lineStrong },
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

/**
 * A grey block with a soft light sweeping across it while a list loads (UI v2: it reads as "loading", where
 * a plain pulse read as "stuck"). It stops once the content arrives; with reduce motion on it stays still.
 */
export function Skeleton({ height = 16, width = '100%', radius = Radius.control, style }: { height?: number; width?: number | `${number}%`; radius?: number; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const reduce = useReducedMotion();
  const sweep = useSharedValue(0);
  const span = useSharedValue(0);
  useEffect(() => {
    if (!reduce) sweep.set(withRepeat(withTiming(1, { duration: 1100 }), -1, false));
  }, [reduce, sweep]);
  // The light is 40% of the block wide and travels from just off the left edge to just off the right.
  const light = useAnimatedStyle(() => ({ transform: [{ translateX: (sweep.value * 1.4 - 0.4) * span.value }] }));
  return (
    <View accessible={false} onLayout={(e) => span.set(e.nativeEvent.layout.width)} style={[{ height, width, borderRadius: radius, backgroundColor: theme.backgroundSelected, overflow: 'hidden' }, style]}>
      {reduce ? null : <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '40%', backgroundColor: theme.backgroundElement, opacity: 0.55 }, light]} />}
    </View>
  );
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

/** A whole screen waiting for its first answer: the page's own background and the shape of what is coming. */
export function ScreenLoading({ rows = 3, height = 120 }: { rows?: number; height?: number }) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SkeletonList rows={rows} height={height} label={t('common.loading')} />
    </View>
  );
}

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'outline' | 'quiet' | 'danger';

/** The fill, edge and text colour of each button kind (UI v2). One primary per screen; the rest step back. */
export function buttonColors(variant: ButtonVariant, theme: ReturnType<typeof useTheme>): { fill: string | undefined; edge: string | undefined; text: string } {
  switch (variant) {
    case 'primary':
      return { fill: theme.brand, edge: undefined, text: theme.onBrand };
    case 'accent':
      return { fill: theme.accent, edge: undefined, text: theme.onAccent };
    case 'secondary':
      return { fill: theme.backgroundSelected, edge: undefined, text: theme.text };
    case 'outline':
      return { fill: undefined, edge: theme.lineStrong, text: theme.text };
    case 'quiet':
      return { fill: undefined, edge: undefined, text: theme.brandText };
    case 'danger':
      return { fill: theme.dangerSoft, edge: undefined, text: theme.danger };
  }
}

/**
 * The app's button. `primary` is the one main action of a screen (green); `accent` the orange call for
 * a moment that matters (join, renew); `secondary`, `outline` and `quiet` step back in that order;
 * `danger` removes or cancels. An optional icon sits before the title.
 */
export function Button({ title, onPress, busy, disabled, variant = 'primary', icon }: { title: string; onPress: () => void; busy?: boolean; disabled?: boolean; variant?: ButtonVariant; icon?: IconName }) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  const tone = buttonColors(variant, theme);
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ busy: !!busy, disabled: !!busy || !!disabled }}
      disabled={busy || disabled}
      onPress={onPress}
      style={[styles.button, tone.fill ? { backgroundColor: tone.fill } : null, tone.edge ? { borderWidth: 1.5, borderColor: tone.edge } : null, disabled && !busy ? { opacity: 0.5 } : null]}>
      {busy ? (
        <ActivityIndicator color={tone.text} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={20} color={tone.text} /> : null}
          <Text style={withTypeface(StyleSheet.flatten([styles.buttonText, { color: tone.text }]), i18n.language)}>{title}</Text>
        </>
      )}
    </AnimatedPressable>
  );
}

/**
 * A line the person should not miss: what went wrong (red, with a warning sign) or something to know
 * (green, with an i). The icon carries the meaning with the colour, never the colour alone.
 */
export function Notice({ text, tone = 'info' }: { text: string; tone?: 'info' | 'error' }) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  const error = tone === 'error';
  return (
    <View accessible accessibilityLiveRegion="polite" accessibilityRole={error ? 'alert' : 'text'} style={[styles.notice, { backgroundColor: error ? theme.dangerSoft : theme.brandSoft }]}>
      <Icon name={error ? 'alert' : 'info'} size={20} color={error ? theme.danger : theme.brandText} style={{ marginTop: 1 }} />
      <Text style={withTypeface(StyleSheet.flatten([styles.noticeText, { color: error ? theme.danger : theme.text }]), i18n.language)}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 4 },
  label: { fontSize: 14, fontWeight: '600' },
  input: { minHeight: 52, borderWidth: 1.5, borderRadius: Radius.control, paddingHorizontal: 14, fontSize: 16 },
  inputInRow: { flex: 1, borderWidth: 0, borderRadius: 0, minHeight: 48 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: Radius.control, minHeight: 52, overflow: 'hidden' },
  below: { fontSize: 13, lineHeight: 19 },
  eye: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  codeRow: { flexDirection: 'row', gap: 8 },
  codeBox: { flex: 1, height: 60, borderWidth: 1.5, borderRadius: Radius.control, alignItems: 'center', justifyContent: 'center' },
  codeDigit: { ...displayFace, fontSize: 26, lineHeight: 34 },
  codeHidden: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02, color: 'transparent', fontSize: 1 },
  link: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 4 },
  linkText: { fontSize: 15, fontWeight: '700' },
  button: { minHeight: 52, borderRadius: Radius.control, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  buttonText: { fontSize: 16, fontWeight: '700' },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: Radius.control, paddingHorizontal: 12, paddingVertical: 12 },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '500' },
});

/**
 * A section's title (UI v2): the slanted orange mark taken from the logo's K, the title in the heading
 * face, and an optional link on the right ("See all"). The mark is decoration and hidden from readers.
 */
export function SectionHeading({ title, action, small }: { title: string; action?: { title: string; onPress: () => void }; small?: boolean }) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  return (
    <View style={headingStyles.row}>
      <View accessible={false} importantForAccessibility="no" style={[headingStyles.mark, small && headingStyles.markSmall, { backgroundColor: theme.accent }]} />
      <Text accessibilityRole="header" style={withTypeface(StyleSheet.flatten([headingStyles.title, small && headingStyles.titleSmall, { color: theme.text }]), i18n.language)} numberOfLines={2}>
        {title}
      </Text>
      {action ? (
        <Pressable accessibilityRole="link" onPress={action.onPress} hitSlop={8} style={({ pressed }) => [headingStyles.action, pressed && { opacity: 0.7 }]}>
          <Text style={withTypeface(StyleSheet.flatten([headingStyles.actionText, { color: theme.brandText }]), i18n.language)}>{action.title}</Text>
          <Icon name="arrow-right" size={16} color={theme.brandText} />
        </Pressable>
      ) : null}
    </View>
  );
}

const headingStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 32 },
  mark: { width: 7, height: 20, borderRadius: 2, transform: [{ skewX: '-18deg' }] },
  title: { ...displayFace, flex: 1, fontSize: 22, lineHeight: 28 },
  markSmall: { width: 6, height: 16 },
  titleSmall: { fontSize: 18, lineHeight: 24 },
  action: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 14, fontWeight: '700' },
});

/** A screen with nothing to show yet: an icon, a short line and, when it helps, one action. */
export function EmptyState({ text, title, action, icon }: { text: string; title?: string; action?: { title: string; onPress: () => void }; icon?: IconName }) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  return (
    <View style={[emptyStyles.empty, { backgroundColor: theme.background }]}>
      {icon ? (
        <View style={[emptyStyles.icon, { backgroundColor: theme.accentSoft }]}>
          <Icon name={icon} size={28} color={theme.accentText} active />
        </View>
      ) : null}
      {title ? (
        <Text accessibilityRole="header" style={withTypeface(StyleSheet.flatten([emptyStyles.emptyTitle, { color: theme.text }]), i18n.language)}>
          {title}
        </Text>
      ) : null}
      <Text style={withTypeface(StyleSheet.flatten([emptyStyles.emptyText, { color: theme.textSecondary }]), i18n.language)}>{text}</Text>
      {action ? <Button title={action.title} variant="accent" icon="arrow-right" onPress={action.onPress} /> : null}
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  empty: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
  icon: { width: 64, height: 64, borderRadius: Radius.card, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  emptyTitle: { ...displayFace, fontSize: 22, lineHeight: 28, textAlign: 'center' },
  emptyText: { fontSize: 16, lineHeight: 24, fontWeight: '500', textAlign: 'center' },
});

/**
 * The top of a screen (UI v2): an optional small line above, the one big line in the heading face, and a
 * sentence under it. One per screen, so the eye knows where it is.
 */
export function PageTitle({ title, sub, eyebrow, right }: { title: string; sub?: string | null; eyebrow?: string; right?: ReactNode }) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  return (
    <View style={pageStyles.row}>
      <View style={{ flex: 1, gap: 4 }}>
        {eyebrow ? <Text style={withTypeface(StyleSheet.flatten([pageStyles.eyebrow, { color: theme.accentText }]), i18n.language)}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={withTypeface(StyleSheet.flatten([pageStyles.title, { color: theme.text }]), i18n.language)}>
          {title}
        </Text>
        {sub ? <Text style={withTypeface(StyleSheet.flatten([pageStyles.sub, { color: theme.textSecondary }]), i18n.language)}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/**
 * A number that counts up to its value when it appears or changes (prizes, points, a balance): about
 * half a second, slowing at the end. With reduce motion on it is just the number.
 */
export function useCountUp(value: number, ms: number = Duration.count): number {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  const from = useRef(0);
  useEffect(() => {
    if (reduce || !Number.isFinite(value) || value === from.current) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = from.current;
    const t0 = Date.now();
    let frame = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - t0) / ms);
      setShown(countStep(start, value, p));
      if (p < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      from.current = value;
    };
  }, [value, ms, reduce]);
  return shown;
}

/** `format` turns the running value into text (money, Bangla digits). Screen readers get the final value at once. */
export function CountUp({ value, format, style }: { value: number; format: (n: number) => string; style?: StyleProp<TextStyle> }) {
  const { i18n } = useTranslation();
  const shown = useCountUp(value);
  return (
    <Text accessibilityLabel={format(value)} style={withTypeface(StyleSheet.flatten(style), i18n.language)}>
      {format(shown)}
    </Text>
  );
}

/** One figure with its label: a balance, points, days left. `tone` colours the figure. */
export function Stat({ label, value, tone = 'text', style, compact }: { label: string; value: ReactNode; tone?: 'text' | 'brand' | 'prize' | 'danger'; style?: StyleProp<ViewStyle>; compact?: boolean }) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  const ink = tone === 'brand' ? theme.brandText : tone === 'prize' ? theme.prizeText : tone === 'danger' ? theme.danger : theme.text;
  return (
    <View style={[pageStyles.stat, { backgroundColor: theme.backgroundElement, borderColor: theme.line }, style]}>
      <Text style={withTypeface(StyleSheet.flatten([pageStyles.statLabel, { color: theme.textSecondary }]), i18n.language)} numberOfLines={2}>
        {label}
      </Text>
      {typeof value === 'string' || typeof value === 'number' ? (
        // One line always: a long amount shrinks to fit (three tiles share a phone's width).
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={withTypeface(StyleSheet.flatten([pageStyles.statValue, compact && pageStyles.statValueCompact, { color: ink }]), i18n.language)}>
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  );
}

/**
 * A card that opens a page with nothing on it yet, or a step the person must take first: what this is
 * for, in a sentence, with the action placed right under it by the screen. (EmptyState fills a whole
 * screen; this sits in the page's flow.)
 */
export function IntroCard({ icon, title, text, children }: { icon: IconName; title: string; text: string; children?: ReactNode }) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  return (
    <View style={[pageStyles.intro, { backgroundColor: theme.backgroundElement, borderColor: theme.line }]}>
      <View style={[pageStyles.introIcon, { backgroundColor: theme.accentSoft }]}>
        <Icon name={icon} size={28} color={theme.accentText} active />
      </View>
      <Text accessibilityRole="header" style={withTypeface(StyleSheet.flatten([pageStyles.introTitle, { color: theme.text }]), i18n.language)}>
        {title}
      </Text>
      <Text style={withTypeface(StyleSheet.flatten([pageStyles.introText, { color: theme.textSecondary }]), i18n.language)}>{text}</Text>
      {children}
    </View>
  );
}

/** The person's initials on the action green: the account's face until there are photos. */
export function Avatar({ letters, size = 56 }: { letters: string; size?: number }) {
  const theme = useTheme();
  return (
    <View accessible={false} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.brand, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ ...displayFace, fontSize: size * 0.38, lineHeight: size * 0.5, color: theme.onBrand }}>{letters}</Text>
    </View>
  );
}

const pageStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  eyebrow: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  title: { ...displayFace, fontSize: 28, lineHeight: 34 },
  sub: { fontSize: 15, lineHeight: 22, fontWeight: '500' },
  stat: { flex: 1, borderWidth: 1, borderRadius: Radius.card, padding: 14, gap: 2, minHeight: 84, justifyContent: 'center' },
  statLabel: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  statValue: { ...displayFace, fontSize: 24, lineHeight: 30 },
  statValueCompact: { fontSize: 18, lineHeight: 24 },
  intro: { borderWidth: 1, borderRadius: Radius.card, padding: 20, gap: 10 },
  introIcon: { width: 56, height: 56, borderRadius: Radius.control, alignItems: 'center', justifyContent: 'center' },
  introTitle: { ...displayFace, fontSize: 22, lineHeight: 28 },
  introText: { fontSize: 15, lineHeight: 22, fontWeight: '500' },
});
