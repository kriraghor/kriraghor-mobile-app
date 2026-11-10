import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Card, ErrorNotice } from '@/components/gym';
import { ThemedText } from '@/components/themed-text';
import { Button, EmptyState, Notice, SkeletonList } from '@/components/ui';
import { Radius } from '@/constants/motion';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, idempotencyKey } from '@/lib/esports-api';
import { count, type Lang } from '@/lib/format';
import { bookableDays, clockTime, dateOnly, dhakaMinuteNow, dhakaToday, visitTimes } from '@/lib/gym';
import { bookVisit, gymPage, visitSlots } from '@/lib/gym-api';
import { useGate } from '@/lib/use-gate';
import { keys } from '@/lib/use-realtime';

/**
 * Book a free visit (M24-FR-110, FR-111; mirrors gym.kriraghor.com /gyms/[slug]/visit): pick an open
 * day with a place left and an arrival time inside the gym's hours. It is free and confirmed at once;
 * the gym is told. Booking asks for a sign-in only when tapped and needs a verified phone, never NID.
 */
export default function GymVisitBookScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const qc = useQueryClient();
  const gate = useGate();
  const gym = useQuery({ queryKey: ['gym-page', slug], queryFn: () => gymPage(slug), enabled: !!slug, retry: false });
  const slots = useQuery({ queryKey: ['gym-visit-slots', slug], queryFn: () => visitSlots(slug), enabled: !!slug, retry: false });
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const key = useRef<string | null>(null);

  if (gym.isLoading || slots.isLoading) return <SkeletonList rows={3} height={96} label={t('common.loading')} />;
  if (!gym.data || !slots.data) {
    return (
      <View style={[styles.page, { flex: 1, backgroundColor: theme.background }]}>
        <ErrorNotice error={gym.error ?? slots.error} onRetry={() => (void gym.refetch(), void slots.refetch())} />
      </View>
    );
  }

  const g = gym.data;
  const today = dhakaToday();
  const nowMinute = dhakaMinuteNow();
  const days = slots.data.open ? bookableDays(slots.data.days, { today, nowMinute }) : [];
  if (!slots.data.open) return <EmptyState icon="gym" text={t('gymVisit.closed')} action={{ title: t('gymPage.back'), onPress: () => router.back() }} />;
  if (!days.length) return <EmptyState icon="gym" text={t('gymVisit.full')} action={{ title: t('gymPage.back'), onPress: () => router.back() }} />;

  const day = days.find((d) => d.date === date) ?? days[0];
  const times = visitTimes(day.windows, { isToday: day.date === today, nowMinute });
  const at = time && times.includes(time) ? time : null;
  const dayLabel = (d: string) => (d === today ? t('gymVisit.today') : dateOnly(d, lang, { weekday: true, year: false }));

  // A retry after a network failure reuses the key; an answer from the API (or success) starts a new one.
  const send = async () => {
    if (!at || busy) return;
    setBusy(true);
    setError(null);
    key.current ??= idempotencyKey('gymvisit');
    try {
      await bookVisit({ gymId: g.id, date: day.date, arriveAt: at }, key.current);
      key.current = null;
      void qc.invalidateQueries({ queryKey: keys.gymVisits });
      void qc.invalidateQueries({ queryKey: ['gym-visit-slots', slug] });
      router.replace('/gym/visits');
    } catch (err) {
      if (err instanceof ApiError) key.current = null;
      setError(err);
      void slots.refetch();
    } finally {
      setBusy(false);
    }
  };

  const chip = (on: boolean) => [styles.chip, { borderColor: on ? theme.brand : theme.line, backgroundColor: on ? theme.brand : theme.backgroundElement }];
  return (
    <>
      <Stack.Screen options={{ title: t('gymVisit.title') }} />
      <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.page}>
        <ThemedText style={styles.title}>{t('gymVisit.heading', { gym: g.name })}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('gymVisit.lead')}
        </ThemedText>
        {slots.data.note ? (
          <Card>
            <ThemedText type="smallBold">{t('gymVisit.fromGym')}</ThemedText>
            <ThemedText type="small">{slots.data.note}</ThemedText>
          </Card>
        ) : null}

        <ThemedText type="smallBold">{t('gymVisit.day')}</ThemedText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t('gymVisit.day')}>
          {days.map((d) => {
            const on = d.date === day.date;
            return (
              <Pressable key={d.date} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => (setDate(d.date), setTime(null))} style={chip(on)}>
                <ThemedText type="smallBold" style={{ color: on ? theme.onBrand : theme.text }}>
                  {dayLabel(d.date)}
                </ThemedText>
                <ThemedText type="small" style={{ color: on ? theme.onBrand : theme.textSecondary }}>
                  {t('gymVisit.places', { n: count(d.placesLeft, lang) })}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>

        <ThemedText type="smallBold">{t('gymVisit.time')}</ThemedText>
        <View style={styles.times} accessibilityRole="radiogroup" accessibilityLabel={t('gymVisit.time')}>
          {times.map((x) => {
            const on = x === at;
            return (
              <Pressable key={x} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setTime(x)} style={[chip(on), styles.timeChip]}>
                <ThemedText type="smallBold" style={{ color: on ? theme.onBrand : theme.text }}>
                  {clockTime(x, lang)}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <ErrorNotice error={error} />
        <Notice text={t('gymVisit.privacy', { gym: g.name })} />
        <Button
          title={at ? t('gymVisit.confirm', { day: dayLabel(day.date), time: clockTime(at, lang) }) : t('gymVisit.pickTime')}
          busy={busy}
          disabled={!at}
          onPress={() => gate('join_gym', () => void send())}
        />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12, paddingBottom: 40 },
  title: { fontSize: 22, lineHeight: 30, fontWeight: '800' },
  chips: { gap: 8, paddingRight: 16 },
  chip: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 6, borderRadius: Radius.control, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: { minWidth: 92 },
});
