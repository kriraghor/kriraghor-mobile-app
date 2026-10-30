import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
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

/** Form primitives on the Kriraghor tokens: 48px targets, square corners (shape lock). */
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
          <MaterialCommunityIcons name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color={theme.textSecondary} />
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

export function Button({ title, onPress, busy, disabled, variant = 'primary' }: { title: string; onPress: () => void; busy?: boolean; disabled?: boolean; variant?: 'primary' | 'outline' }) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: !!busy, disabled: !!busy || !!disabled }}
      disabled={busy || disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary ? { backgroundColor: theme.brand } : { borderWidth: 2, borderColor: theme.text },
        pressed && { opacity: 0.85 },
        disabled && !busy && { opacity: 0.5 },
      ]}>
      {busy ? <ActivityIndicator color={primary ? theme.onBrand : theme.text} /> : <Text style={withTypeface(StyleSheet.flatten([styles.buttonText, { color: primary ? theme.onBrand : theme.text }]), i18n.language)}>{title}</Text>}
    </Pressable>
  );
}

export function Notice({ text, tone = 'info' }: { text: string; tone?: 'info' | 'error' }) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={withTypeface(StyleSheet.flatten([styles.notice, { borderLeftColor: tone === 'error' ? theme.danger : theme.brand, color: tone === 'error' ? theme.danger : theme.text }]), i18n.language)}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  field: { gap: 4 },
  label: { fontSize: 14, fontWeight: '600' },
  input: { minHeight: 48, borderWidth: 2, paddingHorizontal: 12, fontSize: 16 },
  inputInRow: { flex: 1, borderWidth: 0, minHeight: 44 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, minHeight: 48 },
  below: { fontSize: 13, lineHeight: 19 },
  eye: { width: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
  codeRow: { flexDirection: 'row', gap: 8 },
  codeBox: { flex: 1, height: 56, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  codeDigit: { fontSize: 24, lineHeight: 32, fontWeight: '700' },
  codeHidden: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02, color: 'transparent', fontSize: 1 },
  link: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 4 },
  linkText: { fontSize: 15, fontWeight: '700' },
  button: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  buttonText: { fontSize: 16, fontWeight: '700' },
  notice: { borderLeftWidth: 4, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
});

/** A screen with nothing to show yet: a short line and, when it helps, one action. */
export function EmptyState({ text, action }: { text: string; action?: { title: string; onPress: () => void } }) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  return (
    <View style={[emptyStyles.empty, { backgroundColor: theme.background }]}>
      <Text style={withTypeface(StyleSheet.flatten([emptyStyles.emptyText, { color: theme.textSecondary }]), i18n.language)}>{text}</Text>
      {action ? <Button title={action.title} onPress={action.onPress} /> : null}
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  empty: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
  emptyText: { fontSize: 16, lineHeight: 24, fontWeight: '500', textAlign: 'center' },
});
