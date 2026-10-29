import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTranslation } from 'react-i18next';
import { withTypeface } from '@/constants/fonts';
import { useTheme } from '@/hooks/use-theme';

/** Form primitives on the Kriraghor tokens: 48px targets, square corners (shape lock). */
export function Field({ label, error, ...input }: TextInputProps & { label: string; error?: string | null }) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  return (
    <View style={styles.field}>
      <Text style={withTypeface(StyleSheet.flatten([styles.label, { color: theme.textSecondary }]), i18n.language)}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.textSecondary}
        style={withTypeface(StyleSheet.flatten([styles.input, { color: theme.text, borderColor: error ? theme.danger : theme.line, backgroundColor: theme.backgroundElement }]), i18n.language)}
        {...input}
      />
    </View>
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
