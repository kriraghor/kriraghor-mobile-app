import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { InfoRow, Pill, SectionTitle } from '@/components/esports';
import { ThemedText } from '@/components/themed-text';
import { Button, CountUp, Notice, ScreenLoading } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { config } from '@/lib/config';
import { errorText } from '@/lib/errors';
import { title } from '@/lib/esports';
import { ApiError, gate, idempotencyKey, myWithdrawals, payoutAccounts, winnings, withdrawable, withdrawNow } from '@/lib/esports-api';
import { count, dateTime, money, type Lang } from '@/lib/format';
import { OPEN_WITHDRAWALS, withdrawState } from '@/lib/player';
import { SignedInOnly } from '@/components/guest';
import { inEsports } from '@/hooks/theme-scope';
import { Radius } from '@/constants/motion';
import { displayFace } from '@/constants/fonts';
import { RowLink } from '@/components/gym';

/**
 * Winnings (M21-FR-24, FR-25): prizes credited to the player's balance, and withdrawing them to the
 * one approved bKash or Nagad account. Withdrawing needs NID KYC (done on kriraghor.com), an approved
 * payout account, at least the minimum, and stays within the daily cap. Each tap is one request with
 * its own Idempotency-Key.
 */
function WinningsScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const qc = useQueryClient();
  const won = useQuery({ queryKey: ['winnings'], queryFn: winnings });
  const avail = useQuery({ queryKey: ['withdrawable'], queryFn: withdrawable });
  const history = useQuery({ queryKey: ['withdrawals'], queryFn: myWithdrawals });
  const accounts = useQuery({ queryKey: ['payout-accounts'], queryFn: payoutAccounts });
  const check = useQuery({ queryKey: ['gate', 'withdraw_winnings'], queryFn: () => gate('withdraw_winnings') });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const key = useRef(idempotencyKey('wd'));

  const refreshAll = () => {
    for (const k of ['winnings', 'withdrawable', 'withdrawals', 'payout-accounts', 'gate']) void qc.invalidateQueries({ queryKey: [k] });
  };

  if (won.isLoading) return <ScreenLoading />;
  const w = won.data;
  const active = accounts.data?.find((a) => a.status === 'active');
  const state = withdrawState({
    gate: check.data ?? null,
    accounts: accounts.data ?? [],
    available: avail.data ?? null,
    open: (history.data ?? []).some((h) => OPEN_WITHDRAWALS.includes(h.status)),
  });

  async function withdraw() {
    setBusy(true);
    setNote(null);
    try {
      const r = await withdrawNow(key.current);
      key.current = idempotencyKey('wd');
      setNote({ tone: 'info', text: t('winnings.withdrawn', { code: r.code, account: active?.masked ?? '' }) });
    } catch (err) {
      if (err instanceof ApiError) key.current = idempotencyKey('wd');
      setNote({ tone: 'error', text: errorText(t, err) });
    } finally {
      setBusy(false);
      refreshAll();
    }
  }

  const verifyNid = () => void WebBrowser.openBrowserAsync(`${config.webUrl}/account/verification`);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={won.isRefetching} onRefresh={refreshAll} tintColor={theme.brand} />}>
      {won.error ? <Notice tone="error" text={errorText(t, won.error)} /> : null}
      {w ? (
        <View style={[styles.balance, { borderColor: theme.prize, backgroundColor: theme.accentSoft }]}>
          <ThemedText type="eyebrow" themeColor="prizeText">
            {t('winnings.available')}
          </ThemedText>
          <CountUp value={w.available.amount} format={(n) => money(n, lang)} style={[styles.amount, { color: theme.prizeText }]} />
          <InfoRow label={t('winnings.totalWon')} value={money(w.totalWon.amount, lang)} />
          <ThemedText type="small" themeColor="textSecondary">
            {t('winnings.minimum', { amount: money(w.minimum.amount, lang) })} · {t('winnings.dailyLeft', { amount: money(w.dailyLimitLeft.amount, lang) })}
          </ThemedText>
        </View>
      ) : null}

      {note ? <Notice tone={note.tone} text={note.text} /> : null}
      {state.kind === 'ready' ? <Button title={t('winnings.withdraw', { amount: money(state.amount, lang) })} variant="accent" icon="wallet" busy={busy} onPress={() => void withdraw()} /> : null}
      {state.kind === 'kyc' ? (
        <>
          <Notice text={state.pending ? t('winnings.kycPending') : t('winnings.kycNeeded')} />
          {!state.pending ? <Button title={t('winnings.verifyNid')} variant="outline" onPress={verifyNid} /> : null}
        </>
      ) : null}
      {state.kind === 'account_missing' ? <Notice text={t('winnings.accountMissing')} /> : null}
      {state.kind === 'account_pending' ? <Notice text={t('winnings.accountPending')} /> : null}
      {state.kind === 'below_minimum' && (w?.available.amount ?? 0) > 0 ? <Notice text={t('winnings.belowMinimum', { amount: money(state.minimum, lang) })} /> : null}
      {state.kind === 'daily_limit' ? <Notice text={t('winnings.dailyLimit')} /> : null}
      {state.kind === 'open' ? <Notice text={t('winnings.open')} /> : null}
      <RowLink icon="bank" label={t('winnings.payoutAccount')} hint={active?.masked ?? undefined} onPress={() => router.push('/payout-account')} />

      {history.data?.length ? (
        <>
          <SectionTitle>{t('winnings.history')}</SectionTitle>
          {history.data.map((h) => (
            <View key={h.id} style={[styles.item, { borderBottomColor: theme.line }]}>
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold">{money(h.amount, lang)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {h.code} · {dateTime(h.paidAt ?? h.createdAt, lang)}
                </ThemedText>
              </View>
              <Pill text={t(`winnings.withdrawalStatus.${h.status}`)} tone={h.status === 'paid' ? 'brand' : h.status === 'failed' || h.status === 'cancelled' ? 'danger' : 'neutral'} />
            </View>
          ))}
        </>
      ) : null}

      <SectionTitle>{t('winnings.title')}</SectionTitle>
      {!w?.items.length ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('winnings.empty')}
        </ThemedText>
      ) : (
        w.items.map((it) => (
          <View key={it.id} style={[styles.item, { borderBottomColor: theme.line }]}>
            <View style={{ flex: 1 }}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {title(it.tournament, lang)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {it.kind === 'place' && it.place ? t('winnings.place', { place: count(it.place, lang) }) : t('winnings.killReward')} · {dateTime(it.createdAt, lang)}
              </ThemedText>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <ThemedText type="smallBold">{money(it.amount.amount, lang)}</ThemedText>
              {it.status !== 'credited' ? <Pill text={t(`winnings.status.${it.status}`)} tone={it.status === 'reversed' ? 'danger' : 'neutral'} /> : null}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12 },
  balance: { borderWidth: 1.5, padding: 16, gap: 4, borderRadius: Radius.card },
  amount: { ...displayFace, fontSize: 40, lineHeight: 48 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
});

/** The person's own page: a guest sees a friendly Sign in (the modal closes back here), never an error. */
function WinningsScreenRoute() {
  return (
    <SignedInOnly>
      <WinningsScreen />
    </SignedInOnly>
  );
}

// Dark like the Esports section it belongs to (UI v2).
export default inEsports(WinningsScreenRoute);
