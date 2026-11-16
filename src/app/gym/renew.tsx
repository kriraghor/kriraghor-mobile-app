import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { renewalKey } from '@/components/gym-progress';
import { Card, ErrorNotice, GymGate } from '@/components/gym';
import { ThemedText } from '@/components/themed-text';
import { Button, EmptyState, Notice } from '@/components/ui';
import { Radius } from '@/constants/motion';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { ApiError, idempotencyKey } from '@/lib/esports-api';
import { count, money, type Lang } from '@/lib/format';
import { dateOnly } from '@/lib/gym';
import { myRenewal, renewMine, type RenewPay } from '@/lib/gym-api';
import { firstChoice, firstPay, renewState } from '@/lib/gym-progress';
import { keys } from '@/lib/use-realtime';
import { displayFace } from '@/constants/fonts';

/**
 * Renew my membership (M24 §19, FR-122 to FR-124; mirrors the renew form on gym.kriraghor.com): pick a
 * package (my current one, or one the gym sells online), see its dates and price, and pay online or at
 * the front desk. Online opens the payment; at the desk the fee waits under my dues and the gym is told.
 * A reminder notice opens this screen. Needs a verified phone, never NID.
 */
export default function GymRenewScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const { m: memberId } = useLocalSearchParams<{ m: string }>();
  const { status } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: renewalKey(memberId), queryFn: () => myRenewal(memberId), enabled: status === 'signed_in' && !!memberId, retry: false });
  const [picked, setPicked] = useState<string | null>(null);
  const [how, setHow] = useState<RenewPay | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const key = useRef<string | null>(null);

  if (status !== 'signed_in' || q.isLoading) return <GymGate loading={q.isLoading} />;
  const back = () => router.replace({ pathname: '/gym/[memberId]', params: { memberId } });
  if (!q.data) {
    return (
      <View style={[styles.page, { flex: 1, backgroundColor: theme.background }]}>
        <ErrorNotice error={q.error} onRetry={() => void q.refetch()} />
      </View>
    );
  }
  const r = q.data;
  const state = renewState(r);
  // Opened from a reminder when it is not possible (already renewed, too early, taken at the desk).
  if (state.kind !== 'renew') {
    const text =
      state.kind === 'waiting' ? t('gymRenew.already') : state.kind === 'later' && state.on ? t('gymRenew.later', { date: dateOnly(state.on, lang) }) : state.kind === 'desk' ? t('gymRenew.desk') : t('gymRenew.nothing');
    return <EmptyState icon="gym" text={text} action={{ title: t('gymRenew.back'), onPress: back }} />;
  }

  const chosen = r.packages.find((p) => p.packageId === picked) ?? firstChoice(r.packages);
  const pay: RenewPay = r.onlineFees ? (how ?? firstPay(r)) : 'counter';

  // A retry after a network failure reuses the key; an answer from the API (or success) starts a new one.
  const send = async () => {
    if (!chosen || busy) return;
    setBusy(true);
    setError(null);
    key.current ??= idempotencyKey('gymrenew');
    try {
      const made = await renewMine(memberId, { packageId: chosen.packageId, pay }, key.current);
      key.current = null;
      void qc.invalidateQueries({ queryKey: keys.gym });
      if (made.payment) router.replace({ pathname: '/pay/[paymentId]', params: { paymentId: made.payment.paymentId, memberId } });
      else back();
    } catch (err) {
      if (err instanceof ApiError) key.current = null;
      setError(err);
      void q.refetch();
    } finally {
      setBusy(false);
    }
  };

  const box = (on: boolean) => [styles.box, { borderColor: on ? theme.brand : theme.line, backgroundColor: theme.backgroundElement }];
  const chip = (on: boolean) => [styles.chip, { borderColor: on ? theme.brand : theme.line, backgroundColor: on ? theme.brand : theme.backgroundElement }];
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.page}>
      <ThemedText style={styles.title}>{r.gym.name}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t('gymRenew.lead')}
      </ThemedText>

      <ThemedText type="smallBold">{t('gymRenew.package')}</ThemedText>
      <View style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={t('gymRenew.package')}>
        {r.packages.map((p) => {
          const on = p.packageId === chosen?.packageId;
          return (
            <Pressable key={p.packageId} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setPicked(p.packageId)} style={box(on)}>
              <View style={styles.row}>
                <ThemedText type="smallBold" style={{ flex: 1 }}>
                  {p.title}
                </ThemedText>
                <ThemedText type="smallBold">{money(p.pricePoisha, lang)}</ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {dateOnly(p.startsOn, lang)} – {dateOnly(p.endsOn, lang)} · {t('gymRenew.days', { n: count(p.days, lang) })}
              </ThemedText>
              {p.current ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('gymRenew.currentPackage')}
                </ThemedText>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {r.onlineFees ? (
        <>
          <ThemedText type="smallBold">{t('gymRenew.how')}</ThemedText>
          <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t('gymRenew.how')}>
            {(['online', 'counter'] as const).map((k) => {
              const on = k === pay;
              return (
                <Pressable key={k} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setHow(k)} style={chip(on)}>
                  <ThemedText type="smallBold" style={{ color: on ? theme.onBrand : theme.text }}>
                    {t(`gymRenew.${k}`)}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {t(pay === 'online' ? 'gymRenew.onlineHint' : 'gymRenew.counterHint')}
          </ThemedText>
        </>
      ) : (
        <Card muted>
          <ThemedText type="small">{t('gymRenew.noOnline')}</ThemedText>
        </Card>
      )}

      {error ? <ErrorNotice error={error} /> : null}
      {!chosen ? <Notice text={t('gymRenew.nothing')} /> : null}
      <Button
        variant="accent"
        title={chosen && pay === 'online' ? t('gymRenew.sendOnline', { amount: money(chosen.pricePoisha, lang) }) : t('gymRenew.sendCounter')}
        busy={busy}
        disabled={!chosen}
        onPress={() => void send()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12, paddingBottom: 40 },
  title: { ...displayFace, fontSize: 22, lineHeight: 28 },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  box: { borderWidth: 1.5, borderRadius: Radius.control, padding: 12, gap: 2, minHeight: 56 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 16, borderRadius: Radius.control, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
