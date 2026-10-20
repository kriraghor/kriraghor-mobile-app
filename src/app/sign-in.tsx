import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Button, Field, Notice } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { api, problemMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Step = { kind: 'phone' } | { kind: 'code'; target: string } | { kind: 'signup'; signupToken: string };
type AuthBody = { status?: string; accessToken?: string; refreshToken?: string; signupToken?: string };

/**
 * M01 phone OTP sign-in for mobile. A verified code signs in an existing account, or returns a
 * signup token and the user adds their name. Tokens come back in the body (X-Client-Type: mobile).
 */
export default function SignIn() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { signedIn } = useAuth();
  const [step, setStep] = useState<Step>({ kind: 'phone' });
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch {
      setError(t('common.offline'));
    } finally {
      setBusy(false);
    }
  }

  async function finish(body: AuthBody | undefined) {
    if (body?.status === 'signed_in' && body.accessToken) {
      await signedIn({ accessToken: body.accessToken, refreshToken: body.refreshToken });
      router.dismissTo('/account');
    } else if (body?.status === 'signup' && body.signupToken) {
      setStep({ kind: 'signup', signupToken: body.signupToken });
    }
  }

  const sendCode = () =>
    run(async () => {
      const { error: err } = await api.POST('/auth/otp/send', { body: { target: phone.trim(), purpose: 'login' } });
      if (err) return setError(problemMessage(err));
      setInfo(t('signIn.codeSent'));
      setStep({ kind: 'code', target: phone.trim() });
    });

  const verify = () =>
    run(async () => {
      if (step.kind !== 'code') return;
      const { data, error: err } = await api.POST('/auth/otp/verify', { body: { target: step.target, purpose: 'login', code: code.trim() } });
      if (err) return setError(problemMessage(err));
      await finish(data as AuthBody);
    });

  const createAccount = () =>
    run(async () => {
      if (step.kind !== 'signup') return;
      const { data, error: err } = await api.POST('/auth/signup', { body: { signupToken: step.signupToken, displayName: name.trim() } });
      if (err) return setError(problemMessage(err));
      await finish(data as AuthBody);
    });

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <ThemedText style={styles.title}>{t('signIn.title')}</ThemedText>
        <ThemedText themeColor="textSecondary">{t('signIn.sub')}</ThemedText>
        {error ? <Notice tone="error" text={error} /> : null}
        {info && !error ? <Notice text={info} /> : null}

        {step.kind === 'phone' ? (
          <>
            <Field label={t('signIn.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" placeholder="01XXXXXXXXX" />
            <Button title={t('signIn.sendCode')} busy={busy} onPress={sendCode} />
          </>
        ) : null}

        {step.kind === 'code' ? (
          <>
            <Field label={t('signIn.code')} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} />
            <Button title={t('signIn.verify')} busy={busy} onPress={verify} />
          </>
        ) : null}

        {step.kind === 'signup' ? (
          <>
            <Field label={t('signIn.name')} value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
            <Button title={t('signIn.createAccount')} busy={busy} onPress={createAccount} />
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, gap: 16 },
  title: { fontSize: 28, lineHeight: 36, fontWeight: '800' },
});
