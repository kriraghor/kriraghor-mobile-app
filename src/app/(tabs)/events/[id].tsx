import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InfoRow, Pill, SectionTitle, SlotsBar } from '@/components/esports';
import { ThemedText } from '@/components/themed-text';
import { Button, Notice } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { errorText } from '@/lib/errors';
import { eventCta, named, title, type TournamentDetail } from '@/lib/esports';
import { getEvent, myRegistrations } from '@/lib/esports-api';
import { count, dateTime, money, type Lang } from '@/lib/format';
import { keys, useRoomEvents } from '@/lib/use-realtime';

/** An event (M21 §4.1): prizes, schedule, points, rules, live slots, and the one action for this player. */
export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const { status } = useAuth();
  const qc = useQueryClient();
  const event = useQuery({ queryKey: keys.event(id), queryFn: () => getEvent(id) });
  const mine = useQuery({ queryKey: keys.registrations, queryFn: myRegistrations, enabled: status === 'signed_in' });

  // Slots and status change live (M21 §9): re-read the event when the server says so.
  useRoomEvents(event.data ? `esports_tournament:${event.data.id}` : null, ['esports.slots_updated', 'esports.status_changed'], () => {
    void qc.invalidateQueries({ queryKey: keys.event(id) });
  });

  if (event.isLoading) return <ActivityIndicator color={theme.brand} style={{ flex: 1, backgroundColor: theme.background }} />;
  if (!event.data) {
    return (
      <View style={[styles.page, { flex: 1, backgroundColor: theme.background }]}>
        <Notice tone="error" text={errorText(t, event.error)} />
        <Button title={t('common.retry')} variant="outline" onPress={() => void event.refetch()} />
      </View>
    );
  }

  const e: TournamentDetail = event.data;
  const myEntry = mine.data?.find((r) => r.tournamentId === e.id) ?? null;
  const cta = eventCta(e, myEntry);
  const free = e.entryFee.amount === 0;
  const stage = e.stages[0];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack.Screen options={{ title: named(e.game, lang) }} />
      <ScrollView contentContainerStyle={[styles.page, { paddingBottom: 120 }]} refreshControl={<RefreshControl refreshing={event.isRefetching} onRefresh={() => void event.refetch()} tintColor={theme.brand} />}>
        <View style={styles.pills}>
          <Pill text={e.entryUnit === 'squad' ? t('events.squadOf', { size: e.mode.teamSize }) : t('events.solo')} tone="brand" />
          {e.organiser ? <Pill text={t('events.byOrganiser', { name: e.organiser.name })} /> : null}
        </View>
        <ThemedText style={styles.title}>{title(e, lang)}</ThemedText>
        <ThemedText themeColor="textSecondary">
          {t('events.starts')} {dateTime(e.startsAt, lang)}
        </ThemedText>
        {e.status === 'cancelled' ? <Notice tone="error" text={t('event.cancelled')} /> : null}

        <View style={[styles.prizeBox, { borderColor: theme.prize, backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('events.prizePool')}
          </ThemedText>
          <ThemedText style={styles.prizeAmount}>{money(e.prizePool.amount, lang)}</ThemedText>
          <InfoRow label={t('events.entry')} value={free ? t('events.free') : money(e.entryFee.amount, lang)} strong />
          {e.killReward && e.killReward.amount > 0 ? <InfoRow label={t('event.killReward')} value={t('events.perKill', { amount: money(e.killReward.amount, lang) })} /> : null}
        </View>

        <SlotsBar taken={e.slotsTaken} max={e.maxSlots} />
        <ThemedText type="small" themeColor="textSecondary">
          {t('events.slots', { taken: count(e.slotsTaken, lang), max: count(e.maxSlots, lang) })}
          {e.waitlist > 0 ? ` · ${t('events.waitlist', { count: e.waitlist })}` : ''}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('event.minPlayers', { min: count(e.minParticipants, lang) })}
        </ThemedText>

        {e.prizes.length ? (
          <>
            <SectionTitle>{t('event.prizes')}</SectionTitle>
            {e.prizes.map((p) => (
              <InfoRow key={p.place} label={t('event.place', { place: count(p.place, lang) })} value={money(p.amount.amount, lang)} strong={p.place === 1} />
            ))}
          </>
        ) : null}

        <SectionTitle>{t('event.schedule')}</SectionTitle>
        {stage?.checkinOpensAt && stage.checkinClosesAt ? <ThemedText type="small">{t('event.checkIn', { from: dateTime(stage.checkinOpensAt, lang), to: dateTime(stage.checkinClosesAt, lang) })}</ThemedText> : null}
        {e.matches.map((m) => (
          <InfoRow key={m.id} label={`${t('event.match', { seq: count(m.seq, lang) })}${m.map ? ` · ${named(m.map, lang)}` : ''}`} value={dateTime(m.startsAt, lang)} />
        ))}

        <SectionTitle>{t('event.points')}</SectionTitle>
        <ThemedText type="small">{t('event.pointsText', { list: pointsList(e.placementPoints, lang), kill: count(e.killPoints, lang) })}</ThemedText>

        {e.rulesMd ? (
          <>
            <SectionTitle>{t('event.rules')}</SectionTitle>
            <ThemedText type="small">{e.rulesMd.replace(/[#*_>`]/g, '')}</ThemedText>
          </>
        ) : null}
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: 12 + insets.bottom, backgroundColor: theme.backgroundElement, borderTopColor: theme.line }]}>
        {cta.kind === 'register' || cta.kind === 'waitlist' ? (
          <Button
            title={cta.kind === 'waitlist' ? t('event.joinWaitlist') : free ? t('event.registerFree') : t('event.register', { fee: money(e.entryFee.amount, lang) })}
            onPress={() => (status === 'signed_in' ? router.push({ pathname: '/register/[id]', params: { id: e.id } }) : router.push('/sign-in'))}
          />
        ) : cta.kind === 'registered' ? (
          <>
            <ThemedText type="smallBold" style={{ color: theme.brandText }}>
              {t('event.youAreIn')} · {t(`matches.status.${cta.registration.status}`)}
            </ThemedText>
            <Button title={t('event.seeMyMatch')} variant="outline" onPress={() => router.navigate('/matches')} />
          </>
        ) : (
          <ThemedText type="smallBold" themeColor="textSecondary" style={{ textAlign: 'center' }}>
            {cta.kind === 'opens_later' ? t('event.opensAt', { at: dateTime(cta.at, lang) }) : cta.kind === 'invite_only' ? t('event.inviteOnly') : t('event.closed')}
          </ThemedText>
        )}
      </View>
    </View>
  );
}

/** Placement points up to the last place that scores (the rest score 0). */
function pointsList(points: number[], lang: Lang) {
  let last = points.length;
  while (last > 1 && points[last - 1] === 0) last -= 1;
  return points.slice(0, last).map((n) => count(n, lang)).join(', ');
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 10 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  title: { fontSize: 24, lineHeight: 32, fontWeight: '800' },
  prizeBox: { borderWidth: 2, padding: 16, gap: 2, marginVertical: 6 },
  prizeAmount: { fontSize: 30, lineHeight: 38, fontWeight: '800' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, gap: 8, borderTopWidth: 1 },
});
