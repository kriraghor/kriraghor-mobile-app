import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Pill, SectionTitle } from '@/components/esports';
import { Card, ErrorNotice, GymGate, gymWeb, openWeb, RowLink } from '@/components/gym';
import { TodayCard } from '@/components/gym-today';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { cardPayState, dateOnly, linkedGyms } from '@/lib/gym';
import { myDues, type Due, type MembershipCard } from '@/lib/gym-api';
import { count, money, type Lang } from '@/lib/format';
import { useMyGyms, useMyPlans, usePayDue, useWaitingInvites } from '@/lib/use-gym';
import { keys } from '@/lib/use-realtime';

/**
 * My gyms (M24 §4.5 gym/index, mirrors gym.kriraghor.com /me): invites waiting (a badge), today's
 * workout and meals, my check-in QR, each gym I belong to with its package, days left and what is
 * outstanding (Pay when the gym takes fees online, else "Pay at the counter"), past gyms apart, then my
 * passes and trainer subscriptions (M20). No gyms → find one on gym.kriraghor.com.
 */
export default function GymHome() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { status } = useAuth();
  const qc = useQueryClient();
  const gyms = useMyGyms();
  const plans = useMyPlans();
  const dues = useQuery({ queryKey: keys.gymDues, queryFn: async () => (await myDues()).items, enabled: status === 'signed_in' });
  const waiting = useWaitingInvites();
  const payDue = usePayDue();

  const gate = <GymGate loading={gyms.isLoading} />;
  if (status !== 'signed_in' || gyms.isLoading) return gate;

  const items = gyms.data?.items ?? [];
  const current = items.filter((m) => m.linked);
  const past = items.filter((m) => !m.linked);
  const canShowQr = linkedGyms(items).length > 0;
  const refreshing = gyms.isRefetching || plans.isRefetching || dues.isRefetching;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void qc.invalidateQueries({ queryKey: keys.gym })} tintColor={theme.brand} />}>
      <ErrorNotice error={gyms.error} onRetry={() => void gyms.refetch()} />

      {canShowQr ? (
        <Pressable accessibilityRole="button" onPress={() => router.navigate('/gym/checkin')} style={({ pressed }) => [styles.qrButton, { backgroundColor: theme.brand }, pressed && { opacity: 0.85 }]}>
          <MaterialCommunityIcons name="qrcode" size={24} color={theme.onBrand} />
          <ThemedText type="smallBold" style={{ color: theme.onBrand, fontSize: 16 }}>
            {t('gym.checkinQr')}
          </ThemedText>
        </Pressable>
      ) : null}

      <RowLink icon="tray-arrow-down" label={t('gym.requests')} hint={waiting ? t('gym.waiting', { n: waiting }) : undefined} badge={waiting} onPress={() => router.push('/gym/requests')} />

      <TodayCard items={plans.data?.items ?? []} today={plans.data?.today ?? null} />

      <ErrorNotice error={payDue.error} />
      {!items.length && !gyms.error ? (
        <Card>
          <ThemedText type="smallBold">{t('gym.noGyms')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('gym.noGymsBody')}
          </ThemedText>
          <Button title={t('gym.findGym')} onPress={() => openWeb(gymWeb('/gyms'))} />
        </Card>
      ) : null}
      {current.map((m) => (
        <GymCard key={m.memberId} m={m} dues={(dues.data ?? []).filter((d) => d.memberId === m.memberId)} pay={payDue} />
      ))}
      {past.length ? (
        <>
          <SectionTitle>{t('gym.past')}</SectionTitle>
          {past.map((m) => (
            <GymCard key={m.memberId} m={m} dues={[]} pay={payDue} />
          ))}
        </>
      ) : null}

      <SectionTitle>{t('gym.more')}</SectionTitle>
      <RowLink icon="ticket-outline" label={t('gymPasses.title')} onPress={() => router.navigate('/gym/passes')} />
      <RowLink icon="whistle-outline" label={t('gymSubs.title')} onPress={() => router.push('/gym/subscriptions')} />
      <RowLink icon="map-search-outline" label={t('gym.findGym')} onPress={() => openWeb(gymWeb('/gyms'))} external />
    </ScrollView>
  );
}

/** One gym I belong to; past (unlinked) gyms are greyed and read-only. */
function GymCard({ m, dues, pay }: { m: MembershipCard; dues: Due[]; pay: ReturnType<typeof usePayDue> }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const state = cardPayState(m);
  const open = () => router.push({ pathname: '/gym/[memberId]', params: { memberId: m.memberId } });
  // One open due pays here; several open the membership, which lists each one with its own Pay.
  const onPay = () => (dues.length === 1 ? void pay.pay(dues[0].dueId, m.memberId) : open());
  return (
    <Pressable accessibilityRole="button" onPress={open} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
      <Card muted={!m.linked}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.gymName} numberOfLines={2}>
              {m.gym?.name ?? t('gym.gym')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {m.memberCode}
            </ThemedText>
          </View>
          <Pill text={t(`gym.memberStatus.${m.status}`)} tone={m.status === 'active' ? 'brand' : m.status === 'expired' || m.status === 'removed' ? 'danger' : 'neutral'} />
        </View>
        {m.current ? (
          <View>
            <ThemedText type="smallBold">{m.current.title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('gym.until', { date: dateOnly(m.current.endsOn, lang) })} ·{' '}
              {m.current.frozen ? t('gym.frozen') : m.current.daysLeft > 0 ? t('gym.daysLeft', { n: count(m.current.daysLeft, lang) }) : t('gym.lastDay')}
            </ThemedText>
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {t('gym.noPackage')}
          </ThemedText>
        )}
        {state.kind !== 'none' ? (
          <View style={styles.owe}>
            <ThemedText type="smallBold" style={{ color: theme.danger, flex: 1 }}>
              {t('gym.outstanding', { amount: money(m.outstandingPoisha, lang) })}
            </ThemedText>
            {state.kind === 'online' ? <Button title={t('gym.pay')} busy={pay.busy !== null && dues.some((d) => d.dueId === pay.busy)} onPress={onPay} /> : null}
          </View>
        ) : null}
        {state.kind === 'counter' && m.linked ? (
          <ThemedText type="small" themeColor="textSecondary">
            {t('gym.payCounter')}
          </ThemedText>
        ) : null}
        {!m.linked ? (
          <ThemedText type="small" themeColor="textSecondary">
            {t('gym.pastNote')}
          </ThemedText>
        ) : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12, paddingBottom: 32 },
  qrButton: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16 },
  cardTop: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  gymName: { fontSize: 18, lineHeight: 26, fontWeight: '700' },
  owe: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
});
