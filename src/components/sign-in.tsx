import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Button, CodeInput, Field, PasswordField, TextLink } from '@/components/ui';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { CODE_LENGTH, maskTarget, NAME_MAX, normalizeUsername, passwordProblem, resendLeft, signupReady, usernameState, type UsernameCheck, type UsernameResult } from '@/lib/auth-flow';

/** Building blocks of the sign-in modal (M01): the same steps and words as kriraghor.com. */

export function StepTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={styles.titleBox}>
      <ThemedText style={styles.title} accessibilityRole="header">
        {title}
      </ThemedText>
      {sub ? <ThemedText themeColor="textSecondary">{sub}</ThemedText> : null}
    </View>
  );
}

/** "Back" at the top of a step (48px target). */
export function BackLink({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.back, pressed && { opacity: 0.7 }]}>
      <MaterialCommunityIcons name="arrow-left" size={20} color={theme.textSecondary} />
      <ThemedText type="smallBold" themeColor="textSecondary">
        {t('signIn.back')}
      </ThemedText>
    </Pressable>
  );
}

/** "New to Kriraghor? Create an account" or "Already have an account? Sign in", under a rule. */
export function Footer({ text, action, onPress }: { text: string; action: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.footer, { borderTopColor: theme.line }]}>
      <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
        {text}
      </ThemedText>
      <TextLink title={action} onPress={onPress} align="center" />
    </View>
  );
}

/**
 * The code step under "Check your messages": where the code went (with Change), six boxes that verify by themselves
 * when full, and Resend after the countdown (60 s, or what the server said).
 */
export function CodeStep({
  target,
  sentAt,
  resendSeconds,
  busy,
  onVerify,
  onResend,
  onChange,
}: {
  target: string;
  sentAt: number;
  resendSeconds: number;
  busy: boolean;
  onVerify: (code: string) => void;
  onResend: () => void;
  onChange: () => void;
}) {
  const { t } = useTranslation();
  const now = useNow();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  // The parent keys this step by sentAt, so a new code starts again with empty boxes.
  const left = resendLeft(sentAt, now, resendSeconds);

  const submit = (value = code) => {
    if (value.length !== CODE_LENGTH) return setError(t('signIn.codeIncomplete'));
    setError(null);
    onVerify(value);
  };

  return (
    <>
      <View style={styles.sentTo}>
        <ThemedText themeColor="textSecondary">{t('signIn.codeSentTo', { target: maskTarget(target) })}</ThemedText>
        <TextLink title={t('signIn.change')} onPress={onChange} />
      </View>
      <CodeInput label={t('signIn.code')} value={code} onChange={setCode} onComplete={(v) => !busy && submit(v)} errorText={error} autoFocus editable={!busy} />
      <Button title={t('signIn.verify')} busy={busy} onPress={() => submit()} />
      {left > 0 ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.center} accessibilityLiveRegion="none">
          {t('signIn.resendIn', { seconds: left })}
        </ThemedText>
      ) : (
        <TextLink title={t('signIn.resend')} onPress={onResend} disabled={busy} align="center" />
      )}
    </>
  );
}

/** Debounced GET /auth/username-available (400 ms after the last key), like the website. */
export function useUsernameCheck(raw: string): UsernameCheck {
  const [result, setResult] = useState<UsernameResult>(null);
  const username = normalizeUsername(raw);
  useEffect(() => {
    if (!username) return;
    const id = setTimeout(() => {
      void api
        .GET('/auth/username-available', { params: { query: { username } } })
        .then(({ data }) => setResult(data ? { for: username, taken: !data.available } : { for: username, error: true }))
        .catch(() => setResult({ for: username, error: true }));
    }, 400);
    return () => clearTimeout(id);
  }, [username]);
  return usernameState(raw, result);
}

export type About = { displayName: string; username: string; password: string };

/** Name, username (checked as you type), optional password, then Create my account. */
export function SignupForm({ initialName, needsUsername, busy, onSubmit }: { initialName: string; needsUsername: boolean; busy: boolean; onSubmit: (v: About) => void }) {
  const { t } = useTranslation();
  const [v, setV] = useState<About>({ displayName: initialName, username: '', password: '' });
  const [tried, setTried] = useState(false);
  const check = useUsernameCheck(v.username);
  const nameError = tried && v.displayName.trim().length < 2 ? t('signIn.nameRequired') : null;
  const usernameError = check.state === 'taken' ? t('signIn.usernameTaken') : check.state === 'invalid' ? t('signIn.usernameInvalid') : tried && needsUsername && check.state === 'empty' ? t('signIn.usernameInvalid') : null;
  const usernameHint = check.state === 'free' ? t('signIn.usernameFree', { username: check.username ?? '' }) : check.state === 'checking' ? t('signIn.usernameChecking') : t('signIn.usernameHint');
  const pw = passwordProblem(v.password, true);
  const passwordError = pw === 'short' && (tried || v.password.length > 0) ? t('signIn.passwordShort') : pw === 'long' ? t('signIn.passwordLong') : null;

  const submit = () => {
    setTried(true);
    if (signupReady(v, check, needsUsername)) onSubmit(v);
  };

  return (
    <>
      <Field
        label={t('signIn.name')}
        value={v.displayName}
        onChangeText={(displayName) => setV({ ...v, displayName })}
        hint={t('signIn.nameHint')}
        errorText={nameError}
        autoComplete="name"
        textContentType="name"
        autoCapitalize="words"
        maxLength={NAME_MAX}
        returnKeyType="next"
      />
      <Field
        label={needsUsername ? t('signIn.usernameRequired') : t('signIn.username')}
        value={v.username}
        onChangeText={(username) => setV({ ...v, username })}
        hint={usernameHint}
        hintTone={check.state === 'free' ? 'good' : 'muted'}
        errorText={usernameError}
        autoComplete="username-new"
        textContentType="username"
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        maxLength={31}
        placeholder="@"
      />
      <PasswordField
        label={t('signIn.signupPassword')}
        value={v.password}
        onChangeText={(password) => setV({ ...v, password })}
        hint={t('signIn.signupPasswordHint')}
        errorText={passwordError}
        autoComplete="new-password"
        textContentType="newPassword"
        maxLength={128}
        showLabel={t('signIn.show')}
        hideLabel={t('signIn.hide')}
        onSubmitEditing={submit}
      />
      <Button title={t('signIn.create')} busy={busy} onPress={submit} />
    </>
  );
}

const styles = StyleSheet.create({
  titleBox: { gap: 6 },
  title: { fontSize: 28, lineHeight: 36, fontWeight: '800' },
  back: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingRight: 8 },
  footer: { borderTopWidth: 1, paddingTop: 16, gap: 0, alignItems: 'center' },
  sentTo: { gap: 0 },
  center: { textAlign: 'center' },
});
