import { Icon } from '@/components/icons/Icon';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Pill } from '@/components/esports';
import { Card, ErrorNotice, GymGate, RowLink } from '@/components/gym';
import { GymDirectory } from '@/components/gym-directory';
import { TodayCard } from '@/components/gym-today';
import { ThemedText } from '@/components/themed-text';
import { AnimatedPressable, Button, SectionHeading } from '@/components/ui';
import { displayFace } from '@/constants/fonts';
import { Radius } from '@/constants/motion';
import { useTabBarInset } from '@/hooks/use-tab-bar-inset';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { cardPayState, dateOnly, linkedGyms } from '@/lib/gym';
import { myDues, type Due, type MembershipCard } from '@/lib/gym-api';
import { count, money, type Lang } from '@/lib/format';
import { useClockWorkplaces, useMyGyms, useMyPlans, usePayDue, useWaitingInvites } from '@/lib/use-gym';
import { keys } from '@/lib/use-realtime';

/**
 * My gyms (M24 §4.5 gym/index, mirrors gym.kriraghor.com /me): invites waiting (a badge), today's
 * workout and meals, my check-in QR, each gym I belong to with its package, days left and what is
 * outstanding (Pay when the gym takes fees online, else "Pay at the counter"), past gyms apart, then my
 * passes and trainer subscriptions (M20), my free visits (M24 §17), my classes (M27-FR-48) and, for
 * someone who works at a gym, My work (M27-FR-73). No gyms → the in-app gym directory. Signed out, this tab is
 * the directory itself, so a guest can browse gyms, buy a pass or ask to join.
 */
export default function GymHome() {
  const theme = useTheme();
  const tabInset = useTabBarInset();
  const { t } = useTranslation();
  const { status } = useAuth();
  const qc = useQueryClient();
  const gyms = useMyGyms();
  const plans = useMyPlans();
  const dues = useQuery({ queryKey: keys.gymDues, queryFn: async () => (await myDues()).items, enabled: status === 'signed_in' });
  const waiting = useWaitingInvites();
  const payDue = usePayDue();
  const work = useClockWorkplaces();

  // A guest gets the gym directory here (browse, buy a pass, ask to join); members get My gyms.
  if (status === 'signed_out') return <GymDirectory />;
  if (status !== 'signed_in' || gyms.isLoading) return <GymGate loading />;

  const items = gyms.data?.items ?? [];
  const current = items.filter((m) => m.linked);
  const past = items.filter((m) => !m.linked);
  const canShowQr = linkedGyms(items).length > 0;
  const refreshing = gyms.isRefetching || plans.isRefetching || dues.isRefetching;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.page, { paddingBottom: 24 + tabInset }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void qc.invalidateQueries({ queryKey: keys.gym })} tintColor={theme.brand} />}>
      <ErrorNotice error={gyms.error} onRetry={() => void gyms.refetch()} />

      {canShowQr ? (
        <AnimatedPressable accessibilityRole="button" onPress={() => router.navigate('/gym/checkin')} style={[styles.qrButton, { backgroundColor: theme.brand }]}>
          <View style={[styles.qrIcon, { backgroundColor: theme.onBrand }]}>
            <Icon name="checkin" size={28} color={theme.brand} active />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={[styles.qrTitle, { color: theme.onBrand }]}>{t('gym.checkinQr')}</ThemedText>
            <ThemedText type="small" style={{ color: theme.onBrand }}>
              {t('gym.checkinQrHint')}
            </ThemedText>
          </View>
          <Icon name="arrow-right" size={24} color={theme.onBrand} />
        </AnimatedPressable>
      ) : null}

      <RowLink icon="download" label={t('gym.requests')} hint={waiting ? t('gym.waiting', { n: waiting }) : undefined} badge={waiting} onPress={() => router.push('/gym/requests')} />

      {canShowQr ? <RowLink icon="people" label={t('gymClasses.title')} onPress={() => router.push('/gym/classes')} /> : null}
      {work.items.length ? <RowLink icon="clock" label={t('gymWork.title')} hint={t('gymWork.rowHint')} onPress={() => router.push('/gym/work')} /> : null}

      <TodayCard items={plans.data?.items ?? []} today={plans.data?.today ?? null} />

      <ErrorNotice error={payDue.error} />
      {!items.length && !gyms.error ? (
        <Card>
          <ThemedText type="smallBold">{t('gym.noGyms')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('gym.noGymsBody')}
          </ThemedText>
          <Button title={t('gym.findGym')} onPress={() => router.push('/gyms')} />
        </Card>
      ) : null}
      {current.map((m) => (
        <GymCard key={m.memberId} m={m} dues={(dues.data ?? []).filter((d) => d.memberId === m.memberId)} pay={payDue} />
      ))}
      {past.length ? (
        <>
          <SectionHeading title={t('gym.past')} />
          {past.map((m) => (
            <GymCard key={m.memberId} m={m} dues={[]} pay={payDue} />
          ))}
        </>
      ) : null}

      <View style={{ marginTop: 8 }}>
        <SectionHeading title={t('gym.more')} />
      </View>
      <RowLink icon="passes" label={t('gymPasses.title')} onPress={() => router.navigate('/gym/passes')} />
      <RowLink icon="hire" label={t('gymSubs.title')} onPress={() => router.push('/gym/subscriptions')} />
      <RowLink icon="calendar-check" label={t('gymVisits.title')} onPress={() => router.push('/gym/visits')} />
      <RowLink icon="search" label={t('gym.findGym')} onPress={() => router.push('/gyms')} />
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
  qrButton: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: Radius.card },
  qrIcon: { width: 52, height: 52, borderRadius: Radius.control, alignItems: 'center', justifyContent: 'center' },
  qrTitle: { ...displayFace, fontSize: 22, lineHeight: 28 },
  cardTop: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  gymName: { ...displayFace, fontSize: 20, lineHeight: 26 },
  owe: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
});
