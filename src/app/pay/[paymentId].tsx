import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { InfoRow, SectionTitle } from '@/components/esports';
import { ThemedText } from '@/components/themed-text';
import { Button, Notice } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, getPayment, idempotencyKey, startAttempt, verifyPayment } from '@/lib/esports-api';
import { payDoneRoute, payKind } from '@/lib/gym';
import { errorText } from '@/lib/errors';
import { dateTime, money, type Lang } from '@/lib/format';
import { payInApp, type PayMethod, type PayOutcome } from '@/lib/payment-flow';
import { keys } from '@/lib/use-realtime';
import { SignedInOnly } from '@/components/guest';

const METHODS: PayMethod[] = ['bkash', 'nagad', 'card'];

/**
 * Pay an entry (M06 from the app): choose bKash, Nagad or card, pay on the gateway page, come back to
 * the app, and read the result from the API. Each tap of Pay is a new attempt with a new key.
 * The words and the Done target follow the payment's purpose: an esports entry goes back to Matches;
 * a gym fee (M24 gym_membership_fee) says "Fee paid" and goes back to the membership (memberId param)
 * or My gyms; a gym pass and a trainer month go back to their lists. Gym data is re-read after paying.
 */
function PayScreen() {
  const { paymentId, memberId } = useLocalSearchParams<{ paymentId: string; memberId?: string }>();
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const qc = useQueryClient();
  const payment = useQuery({ queryKey: ['payment', paymentId], queryFn: () => getPayment(paymentId) });
  const [method, setMethod] = useState<PayMethod>('bkash');
  const [phase, setPhase] = useState<'idle' | 'paying' | PayOutcome>('idle');
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  async function pay() {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    setPhase('paying');
    try {
      const outcome = await payInApp(paymentId, method, idempotencyKey('pay'), {
        startAttempt,
        openAuthSession: (url, ret) => WebBrowser.openAuthSessionAsync(url, ret),
        verify: async (id) => (await verifyPayment(id)).status,
        status: async (id) => (await getPayment(id)).status,
        wait: (ms) => new Promise((r) => setTimeout(r, ms)),
      });
      setPhase(outcome);
      void qc.invalidateQueries({ queryKey: keys.registrations });
      void qc.invalidateQueries({ queryKey: keys.gym });
      void payment.refetch();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : '';
      setPhase(code === 'PAYMENT_EXPIRED' ? 'expired' : code === 'PAYMENT_ALREADY_SUCCEEDED' ? 'paid' : 'idle');
      if (!['PAYMENT_EXPIRED', 'PAYMENT_ALREADY_SUCCEEDED'].includes(code)) setError(code === 'PROVIDER_UNAVAILABLE' ? t('pay.unavailable') : errorText(t, err));
    } finally {
      busy.current = false;
    }
  }

  if (payment.isLoading) return <ActivityIndicator color={theme.brand} style={{ flex: 1, backgroundColor: theme.background }} />;
  const p = payment.data;
  const settled = phase === 'paid' || phase === 'expired' || phase === 'cancelled';
  const kind = payKind(p?.purpose);
  const gym = kind !== 'entry';
  const paidText = kind === 'gym_fee' ? t('pay.feePaid') : kind === 'gym_pass' ? t('pay.passPaid') : kind === 'trainer' ? t('pay.trainerPaid') : t('pay.paid');
  const message: Record<PayOutcome, string> = { paid: paidText, failed: t('pay.failed'), cancelled: t('pay.cancelled'), expired: gym ? t('pay.gymExpired') : t('pay.expired'), pending: t('pay.pending') };
  const done = () => router.navigate(payDoneRoute(kind, memberId) as never);

  return (
    <View style={[styles.page, { flex: 1, backgroundColor: theme.background }]}>
      {p ? (
        <>
          <ThemedText style={styles.title}>{p.title}</ThemedText>
          <InfoRow label={gym ? t('pay.amount') : t('register.fee')} value={money(p.amount, lang)} strong />
          {p.status === 'initiated' || p.status === 'pending' ? <InfoRow label={t('pay.payBy')} value={dateTime(p.expiresAt, lang)} /> : null}
        </>
      ) : (
        <Notice tone="error" text={errorText(t, payment.error)} />
      )}
      {error ? <Notice tone="error" text={error} /> : null}
      {phase !== 'idle' && phase !== 'paying' ? <Notice tone={phase === 'paid' ? 'info' : 'error'} text={message[phase]} /> : null}

      {settled ? (
        <Button title={t('pay.done')} onPress={done} />
      ) : phase === 'paying' ? (
        <View style={styles.waiting}>
          <ActivityIndicator color={theme.brand} />
          <ThemedText themeColor="textSecondary">{t('pay.checking')}</ThemedText>
        </View>
      ) : p ? (
        <>
          <SectionTitle>{t('pay.choose')}</SectionTitle>
          <View style={styles.methods} accessibilityRole="radiogroup">
            {METHODS.filter((m) => (p.methods ?? METHODS).includes(m)).map((m) => {
              const selected = method === m;
              return (
                <Pressable
                  key={m}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setMethod(m)}
                  style={[styles.method, { borderColor: selected ? theme.brand : theme.line, backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement }]}>
                  <ThemedText type="smallBold" style={{ color: selected ? theme.brandText : theme.text }}>
                    {t(`pay.${m}`)}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          <Button title={t('pay.payNow', { amount: money(p.amount, lang) })} onPress={() => void pay()} />
          {phase === 'pending' ? <Button title={t('pay.done')} variant="outline" onPress={done} /> : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12 },
  title: { fontSize: 22, lineHeight: 30, fontWeight: '800' },
  methods: { flexDirection: 'row', gap: 8 },
  method: { flex: 1, minHeight: 52, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  waiting: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 12 },
});

/** The person's own page: a guest sees a friendly Sign in (the modal closes back here), never an error. */
export default function PayScreenRoute() {
  return (
    <SignedInOnly>
      <PayScreen />
    </SignedInOnly>
  );
}
