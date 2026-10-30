import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { BackLink, CodeStep, Footer, SignupForm, StepTitle, type About } from '@/components/sign-in';
import { ThemedText } from '@/components/themed-text';
import { Button, CodeInput, Field, Notice, PasswordField, TextLink } from '@/components/ui';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { currentLanguage } from '@/i18n';
import { api, problemMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  afterSignIn,
  authError,
  authOutcome,
  CODE_LENGTH,
  codeTarget,
  codeTargetKind,
  normalizeUsername,
  passwordProblem,
  RESEND_SECONDS,
  resendLeft,
  type AuthBody,
  type ProblemLike,
  type Verified,
} from '@/lib/auth-flow';

type Purpose = 'login' | 'signup';
type Step =
  | { kind: 'password' }
  | { kind: 'target'; purpose: Purpose }
  | { kind: 'code'; purpose: Purpose; target: string; sentAt: number; resendSeconds: number }
  | { kind: 'signup'; verified: Verified }
  | { kind: 'resetTarget' }
  | { kind: 'resetCode'; target: string; sentAt: number; resendSeconds: number };

type Tokens = { accessToken: string; refreshToken?: string };

/**
 * Sign in (M01), the same flow as kriraghor.com: a password first (mobile, email or username), and
 * one tap away a one-time code to a phone or email, for the many accounts that have no password.
 * A code for a new number carries on to "Create your account" (name, optional username and
 * password). Forgot password sends a reset code, saves the new password and signs in with it.
 * Tokens come back in the body (X-Client-Type: mobile). Opened as a modal: when done it closes back
 * to where it was opened, else the hub. Nothing typed here is ever logged.
 */
export default function SignIn() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { signedIn } = useAuth();
  const [step, setStep] = useState<Step>({ kind: 'password' });
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [offerCode, setOfferCode] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const go = (next: Step) => {
    setStep(next);
    setError(null);
    setInfo(null);
    setOfferCode(false);
    setFieldError(null);
  };

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setOfferCode(false);
    try {
      await fn();
    } catch {
      setError(t('common.offline'));
    } finally {
      setBusy(false);
    }
  }

  /** Our own words for the codes we know, else the server's title. Returns the step to move to, if any. */
  function fail(err: unknown) {
    const m = authError(err as ProblemLike);
    if (!m) {
      setError(problemMessage(err, t('common.somethingWrong')));
      return null;
    }
    setError(t(`signIn.errors.${m.key}`, { seconds: m.seconds ?? 0 }));
    setOfferCode(Boolean(m.offerCode));
    return m.step ?? null;
  }

  async function finish(tokens: Tokens) {
    await signedIn(tokens);
    if (afterSignIn(router.canGoBack()) === 'back') router.back();
    else router.replace('/');
  }

  /** From the password step to the code step, carrying a phone or email over. */
  const toCode = (purpose: Purpose) => {
    if (codeTargetKind(identifier)) setTarget(identifier.trim());
    go({ kind: 'target', purpose });
  };
  const toPassword = () => {
    if (codeTargetKind(target)) setIdentifier(target.trim());
    go({ kind: 'password' });
  };

  const login = () => {
    if (!identifier.trim()) return setFieldError(t('signIn.identifierRequired'));
    if (!password) return setFieldError(t('signIn.passwordRequired'));
    setFieldError(null);
    void run(async () => {
      const { data, error: err } = await api.POST('/auth/login', { body: { identifier: identifier.trim(), password } });
      if (err) return void fail(err);
      const out = authOutcome(data as AuthBody);
      if (out.kind === 'signed_in') await finish(out.tokens);
      else setError(t('common.somethingWrong'));
    });
  };

  /** POST /auth/otp/send; a resend keeps the step and says a new code went out. */
  const send = (purpose: Purpose | 'reset', raw: string, resend = false) => {
    const to = codeTarget(raw);
    if (!to) return setFieldError(t('signIn.targetInvalid'));
    setFieldError(null);
    void run(async () => {
      const { data, error: err } = await api.POST('/auth/otp/send', { body: { target: to, purpose, locale: currentLanguage() } });
      if (err) return void fail(err);
      const resendSeconds = data?.resendInSeconds || RESEND_SECONDS;
      const sentAt = Date.now();
      setStep(purpose === 'reset' ? { kind: 'resetCode', target: to, sentAt, resendSeconds } : { kind: 'code', purpose, target: to, sentAt, resendSeconds });
      setInfo(resend ? t('signIn.resent') : purpose === 'reset' ? t('signIn.resetSent') : null);
    });
  };

  const verify = (purpose: Purpose, to: string, code: string) =>
    void run(async () => {
      const { data, error: err } = await api.POST('/auth/otp/verify', { body: { target: to, purpose, code } });
      if (err) return void fail(err);
      const out = authOutcome(data as AuthBody);
      if (out.kind === 'signed_in') await finish(out.tokens);
      else if (out.kind === 'signup') go({ kind: 'signup', verified: out.verified });
      else setError(t('common.somethingWrong'));
    });

  /** A sign-up token that ran out sends the person back to get a new code, with the reason. */
  const expired = () => {
    go({ kind: 'target', purpose: 'signup' });
    setError(t('signIn.errors.SIGNUP_TOKEN_INVALID'));
  };

  const create = (verified: Verified, about: About) => {
    if (verified.expiresAt <= Date.now()) return expired();
    void run(async () => {
      const { data, error: err } = await api.POST('/auth/signup', {
        body: {
          signupToken: verified.signupToken,
          displayName: about.displayName.trim(),
          username: normalizeUsername(about.username) ?? undefined,
          password: about.password || undefined,
          locale: currentLanguage(),
        },
      });
      if (err) {
        if (fail(err) === 'code') expired();
        return;
      }
      const out = authOutcome(data as AuthBody);
      if (out.kind === 'signed_in') await finish(out.tokens);
      else setError(t('common.somethingWrong'));
    });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        {step.kind === 'password' ? <StepTitle title={t('signIn.title')} sub={t('signIn.sub')} /> : null}
        {step.kind === 'target' ? (
          <>
            <BackLink onPress={toPassword} />
            <StepTitle title={step.purpose === 'signup' ? t('signIn.signupTitle') : t('signIn.codeTitle')} sub={step.purpose === 'signup' ? t('signIn.signupVerify') : t('signIn.sub')} />
          </>
        ) : null}
        {step.kind === 'signup' ? <StepTitle title={t('signIn.signupTitle')} sub={t('signIn.signupSub')} /> : null}
        {step.kind === 'resetTarget' || step.kind === 'resetCode' ? (
          <>
            <BackLink onPress={toPassword} />
            <StepTitle title={t('signIn.resetTitle')} sub={step.kind === 'resetTarget' ? t('signIn.resetSub') : undefined} />
          </>
        ) : null}

        {error ? <Notice tone="error" text={error} /> : null}
        {offerCode ? <TextLink title={t('signIn.noPasswordHint')} onPress={() => toCode('login')} /> : null}
        {info && !error ? <Notice text={info} /> : null}

        {step.kind === 'password' ? (
          <>
            <Field
              label={t('signIn.identifier')}
              value={identifier}
              onChangeText={setIdentifier}
              errorText={fieldError && !identifier.trim() ? fieldError : null}
              autoComplete="username"
              textContentType="username"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              placeholder="01XXXXXXXXX"
              returnKeyType="next"
            />
            <PasswordField
              label={t('signIn.password')}
              value={password}
              onChangeText={setPassword}
              errorText={fieldError && identifier.trim() && !password ? fieldError : null}
              autoComplete="current-password"
              textContentType="password"
              maxLength={128}
              showLabel={t('signIn.show')}
              hideLabel={t('signIn.hide')}
              returnKeyType="go"
              onSubmitEditing={login}
            />
            <TextLink title={t('signIn.forgot')} onPress={() => (codeTargetKind(identifier) && setTarget(identifier.trim()), go({ kind: 'resetTarget' }))} />
            <Button title={t('signIn.signIn')} busy={busy} onPress={login} />
            <Button title={t('signIn.useCode')} variant="outline" onPress={() => toCode('login')} />
            <Footer text={t('signIn.noAccount')} action={t('signIn.createAccount')} onPress={() => toCode('signup')} />
          </>
        ) : null}

        {step.kind === 'target' ? (
          <>
            <Field
              label={t('signIn.target')}
              value={target}
              onChangeText={setTarget}
              hint={t('signIn.targetHint')}
              errorText={fieldError}
              autoComplete="tel"
              textContentType="username"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              placeholder="01XXXXXXXXX"
              returnKeyType="send"
              onSubmitEditing={() => send(step.purpose, target)}
            />
            <Button title={t('signIn.continue')} busy={busy} onPress={() => send(step.purpose, target)} />
            {step.purpose === 'login' ? (
              <>
                <Button title={t('signIn.usePassword')} variant="outline" onPress={toPassword} />
                <Footer text={t('signIn.noAccount')} action={t('signIn.createAccount')} onPress={() => go({ kind: 'target', purpose: 'signup' })} />
              </>
            ) : (
              <Footer text={t('signIn.haveAccount')} action={t('signIn.signIn')} onPress={toPassword} />
            )}
          </>
        ) : null}

        {step.kind === 'code' ? (
          <CodeStep
            key={step.sentAt}
            target={step.target}
            sentAt={step.sentAt}
            resendSeconds={step.resendSeconds}
            busy={busy}
            onVerify={(code) => verify(step.purpose, step.target, code)}
            onResend={() => send(step.purpose, step.target, true)}
            onChange={() => go({ kind: 'target', purpose: step.purpose })}
          />
        ) : null}

        {step.kind === 'signup' ? (
          <>
            <SignupForm initialName={step.verified.displayName} needsUsername={step.verified.needsUsername} busy={busy} onSubmit={(about) => create(step.verified, about)} />
            <Footer text={t('signIn.haveAccount')} action={t('signIn.signIn')} onPress={toPassword} />
          </>
        ) : null}

        {step.kind === 'resetTarget' ? (
          <>
            <Field
              label={t('signIn.resetTarget')}
              value={target}
              onChangeText={setTarget}
              hint={t('signIn.resetTargetHint')}
              errorText={fieldError}
              autoComplete="username"
              textContentType="username"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              placeholder="01XXXXXXXXX"
              returnKeyType="send"
              onSubmitEditing={() => send('reset', target)}
            />
            <Button title={t('signIn.resetSend')} busy={busy} onPress={() => send('reset', target)} />
            <TextLink title={t('signIn.backToSignIn')} onPress={toPassword} align="center" />
          </>
        ) : null}

        {step.kind === 'resetCode' ? (
          <ResetForm
            key={step.sentAt}
            step={step}
            busy={busy}
            onResend={() => send('reset', step.target, true)}
            onOther={() => go({ kind: 'resetTarget' })}
            onSave={(code, newPassword) =>
              void run(async () => {
                const { error: err } = await api.POST('/auth/password/reset', { body: { target: step.target, code, newPassword } });
                if (err) return void fail(err);
                // Every session was signed out by the reset; sign in here with the new password.
                const { data, error: loginErr } = await api.POST('/auth/login', { body: { identifier: step.target, password: newPassword } });
                const out = loginErr ? null : authOutcome(data as AuthBody);
                if (out?.kind === 'signed_in') return finish(out.tokens);
                setIdentifier(step.target);
                setPassword('');
                go({ kind: 'password' });
                setInfo(t('signIn.resetDone'));
                if (loginErr) fail(loginErr);
              })
            }
          />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** The reset code and the new password typed twice, then Save; Resend after the countdown. */
function ResetForm({ step, busy, onSave, onResend, onOther }: { step: Extract<Step, { kind: 'resetCode' }>; busy: boolean; onSave: (code: string, newPassword: string) => void; onResend: () => void; onOther: () => void }) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [tried, setTried] = useState(false);
  const codeError = tried && code.length !== CODE_LENGTH ? t('signIn.codeIncomplete') : null;
  const problem = passwordProblem(pw, false);
  const pwError = tried && problem === 'short' ? t('signIn.passwordShort') : problem === 'long' ? t('signIn.passwordLong') : null;
  const mismatch = tried && !problem && pw !== again ? t('signIn.mismatch') : null;
  const save = () => {
    setTried(true);
    if (code.length === CODE_LENGTH && !problem && pw === again) onSave(code, pw);
  };
  return (
    <>
      <CodeInput label={t('signIn.code')} value={code} onChange={setCode} errorText={codeError} autoFocus editable={!busy} />
      <PasswordField
        label={t('signIn.newPassword')}
        value={pw}
        onChangeText={setPw}
        hint={t('signIn.newPasswordHint')}
        errorText={pwError}
        autoComplete="new-password"
        textContentType="newPassword"
        maxLength={128}
        showLabel={t('signIn.show')}
        hideLabel={t('signIn.hide')}
      />
      <PasswordField
        label={t('signIn.confirm')}
        value={again}
        onChangeText={setAgain}
        errorText={mismatch}
        autoComplete="new-password"
        textContentType="newPassword"
        maxLength={128}
        showLabel={t('signIn.show')}
        hideLabel={t('signIn.hide')}
        onSubmitEditing={save}
      />
      <Button title={t('signIn.save')} busy={busy} onPress={save} />
      <ResendRow sentAt={step.sentAt} seconds={step.resendSeconds} busy={busy} onResend={onResend} />
      <TextLink title={t('signIn.resetOther')} onPress={onOther} align="center" tone="text" />
    </>
  );
}

function ResendRow({ sentAt, seconds, busy, onResend }: { sentAt: number; seconds: number; busy: boolean; onResend: () => void }) {
  const { t } = useTranslation();
  const now = useNow();
  const left = resendLeft(sentAt, now, seconds);
  return left > 0 ? (
    <View style={styles.resend}>
      <ThemedText type="small" themeColor="textSecondary">
        {t('signIn.resendIn', { seconds: left })}
      </ThemedText>
    </View>
  ) : (
    <TextLink title={t('signIn.resend')} onPress={onResend} disabled={busy} align="center" />
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, gap: 16, paddingBottom: 40 },
  resend: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
