import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { InfoRow, Pill } from '@/components/esports';
import { Card, ErrorNotice, GymGate, gymWeb, openWeb } from '@/components/gym';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { dateOnly } from '@/lib/gym';
import { mySubscriptions, type Subscription } from '@/lib/gym-api';
import { money, type Lang } from '@/lib/format';
import { keys } from '@/lib/use-realtime';

/**
 * My trainer subscriptions (M20, gym.kriraghor.com /me/subscriptions): status, the month I am in, paid
 * through. A month waiting for payment is paid in the app; renew, cancel and "report a problem" open
 * the gym.kriraghor.com page in the browser (they have rules and confirmations of their own there).
 */
export default function GymSubscriptions() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { status } = useAuth();
  const list = useQuery({ queryKey: keys.gymSubscriptions, queryFn: async () => (await mySubscriptions()).items, enabled: status === 'signed_in' });

  if (status !== 'signed_in' || list.isLoading) return <GymGate loading={list.isLoading} />;
  const mine = (list.data ?? []).filter((s) => s.role === 'member');
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={theme.brand} />}>
      <ErrorNotice error={list.error} onRetry={() => void list.refetch()} />
      {list.data && !mine.length ? (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            {t('gymSubs.none')}
          </ThemedText>
          <Button title={t('gymSubs.findTrainer')} variant="outline" onPress={() => openWeb(gymWeb('/trainers'))} />
        </Card>
      ) : null}
      {mine.map((s) => (
        <SubCard key={s.id} s={s} />
      ))}
    </ScrollView>
  );
}

function SubCard({ s }: { s: Subscription }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const web = () => openWeb(gymWeb('/me/subscriptions'));
  const tone = s.status === 'active' ? 'brand' : s.status === 'pending_payment' ? 'prize' : s.status === 'lapsed' || s.status === 'void' ? 'danger' : 'neutral';
  const cur = s.current;
  return (
    <Card muted={s.status === 'ended' || s.status === 'cancelled' || s.status === 'void'}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold" style={{ fontSize: 16 }}>
            {s.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {s.other.name ? t('gymSubs.trainer', { name: s.other.name }) : s.code}
          </ThemedText>
        </View>
        <Pill text={t(`gymSubs.status.${s.status}`)} tone={tone} />
      </View>
      <InfoRow label={t('gymSubs.price')} value={money(s.price, lang)} strong />
      {cur ? <InfoRow label={t('gymSubs.month')} value={`${dateOnly(cur.periodStart, lang)} – ${dateOnly(cur.periodEnd, lang)}`} /> : null}
      {s.paidThrough ? <InfoRow label={t('gymSubs.paidThrough')} value={dateOnly(s.paidThrough, lang)} /> : null}
      {s.status === 'active' && !s.renew ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('gymSubs.endsAtMonthEnd')}
        </ThemedText>
      ) : null}
      {s.payment && s.can.pay ? <Button title={t('gym.pay')} onPress={() => router.push({ pathname: '/pay/[paymentId]', params: { paymentId: s.payment!.id } })} /> : null}
      <View style={styles.actions}>
        {s.can.pay && !s.payment ? <Button title={t('gymSubs.renew')} variant="outline" onPress={web} /> : null}
        {s.can.cancel ? <Button title={t('gymSubs.cancel')} variant="outline" onPress={web} /> : null}
        {s.can.problem ? <Button title={t('gymSubs.problem')} variant="outline" onPress={web} /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12, paddingBottom: 40 },
  top: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  actions: { gap: 8 },
});
