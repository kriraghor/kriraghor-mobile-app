import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Pill } from '@/components/esports';
import { ThemedText } from '@/components/themed-text';
import { SignInPrompt } from '@/components/guest';
import { Button, EmptyState, Notice, SkeletonList } from '@/components/ui';
import { useNow } from '@/hooks/use-now';
import { useTabBarInset } from '@/hooks/use-tab-bar-inset';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { canSplit } from '@/lib/player';
import { useMe } from '@/lib/use-me';
import { errorText } from '@/lib/errors';
import { currentMatch, entryActions, revealAt, title, type EntryAction, type Registration } from '@/lib/esports';
import { acceptOffer, checkIn, idempotencyKey, myRegistrations, withdraw } from '@/lib/esports-api';
import { count, countdown, dateTime, money, type Lang } from '@/lib/format';
import { keys } from '@/lib/use-realtime';

/**
 * My matches (M21 §4.3): every entry with what to do next — pay, take an offered slot, check in,
 * open the room, see the result, withdraw — and a countdown to the room reveal. Re-read every 30
 * seconds and whenever the server sends a room event.
 */
export default function MatchesScreen() {
  const theme = useTheme();
  const tabInset = useTabBarInset();
  const { t } = useTranslation();
  const { status } = useAuth();
  const entries = useQuery({ queryKey: keys.registrations, queryFn: myRegistrations, enabled: status === 'signed_in', refetchInterval: 30_000 });

  // My matches are the person's own: a guest gets Sign in, or keeps browsing events.
  if (status !== 'signed_in') return <SignInPrompt text={t('matches.signedOut')} icon="matches" browse={{ title: t('guest.browseEvents'), onPress: () => router.navigate('/events') }} />;
  if (entries.isLoading) return <View style={{ flex: 1, backgroundColor: theme.background }}><SkeletonList label={t('common.loading')} /></View>;

  const items = (entries.data ?? []).filter((r) => r.status !== 'cancelled');
  return (
    <FlatList
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.list, { paddingBottom: 24 + tabInset }]}
      data={items}
      keyExtractor={(r) => r.id}
      refreshControl={<RefreshControl refreshing={entries.isRefetching} onRefresh={() => void entries.refetch()} tintColor={theme.brand} />}
      ListHeaderComponent={entries.error ? <Notice tone="error" text={errorText(t, entries.error)} /> : null}
      ListEmptyComponent={<EmptyState text={t('matches.empty')} action={{ title: t('matches.findEvent'), onPress: () => router.navigate('/events') }} />}
      renderItem={({ item }) => <EntryCard entry={item} />}
    />
  );
}

function EntryCard({ entry }: { entry: Registration }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const qc = useQueryClient();
  const now = useNow(1000);
  const me = useMe();
  const splittable = canSplit(entry, me.data?.id, now);
  const [busy, setBusy] = useState<EntryAction | null>(null);
  const [note, setNote] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const match = currentMatch(entry);
  const actions = entryActions(entry);
  const reveal = match && ['confirmed', 'checked_in'].includes(entry.status) && ['scheduled', 'room_ready'].includes(match.status) ? countdown(revealAt(match.startsAt), now, lang) : null;
  const tone = entry.status === 'checked_in' || entry.status === 'confirmed' ? 'brand' : ['no_show', 'disqualified', 'withdrawn', 'refunded'].includes(entry.status) ? 'danger' : 'neutral';

  async function run(action: EntryAction, fn: () => Promise<void>) {
    setBusy(action);
    setNote(null);
    try {
      await fn();
    } catch (err) {
      setNote({ tone: 'error', text: errorText(t, err) });
    } finally {
      setBusy(null);
      void qc.invalidateQueries({ queryKey: keys.registrations });
    }
  }

  const press: Record<EntryAction, () => void> = {
    pay: () => entry.paymentId && router.push({ pathname: '/pay/[paymentId]', params: { paymentId: entry.paymentId } }),
    take_slot: () =>
      void run('take_slot', async () => {
        const r = await acceptOffer(entry.id, idempotencyKey('offer'));
        if (r.registration.status === 'pending_payment' && r.registration.paymentId) router.push({ pathname: '/pay/[paymentId]', params: { paymentId: r.registration.paymentId } });
      }),
    check_in: () =>
      void run('check_in', async () => {
        await checkIn(entry.id);
        setNote({ tone: 'info', text: t('matches.checkedIn') });
      }),
    room: () => match && router.push({ pathname: '/room/[matchId]', params: { matchId: match.id } }),
    result: () => match && router.push({ pathname: '/result/[matchId]', params: { matchId: match.id } }),
    withdraw: () =>
      Alert.alert(t('matches.actions.withdraw'), t('matches.withdrawConfirm', { title: entry.tournament ? title(entry.tournament, lang) : '' }), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('matches.actions.withdraw'),
          style: 'destructive',
          onPress: () =>
            void run('withdraw', async () => {
              const r = await withdraw(entry.id);
              setNote({ tone: 'info', text: t('matches.withdrawn', { amount: money(r.refunded?.amount ?? 0, lang) }) });
            }),
        },
      ]),
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.line }]}>
      <View style={styles.row}>
        <Pill text={t(`matches.status.${entry.status}`)} tone={tone} />
        {entry.slotNo ? <Pill text={t('matches.slot', { slot: count(entry.slotNo, lang) })} /> : null}
      </View>
      <ThemedText
        style={styles.title}
        onPress={() => entry.tournament && router.push({ pathname: '/events/[id]', params: { id: entry.tournament.id } })}
        accessibilityRole="link">
        {entry.tournament ? title(entry.tournament, lang) : ''}
      </ThemedText>
      {match ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('matches.match', { seq: count(match.seq, lang), at: dateTime(match.startsAt, lang) })}
        </ThemedText>
      ) : null}
      {entry.status === 'pending_payment' && entry.holdExpiresAt ? <ThemedText type="small">{t('matches.holdUntil', { at: dateTime(entry.holdExpiresAt, lang) })}</ThemedText> : null}
      {entry.status === 'offered' && entry.offerExpiresAt ? <ThemedText type="small">{t('matches.offerUntil', { at: dateTime(entry.offerExpiresAt, lang) })}</ThemedText> : null}
      {entry.status === 'waitlisted' && entry.waitlistPosition ? <ThemedText type="small">{t('matches.waitPosition', { n: count(entry.waitlistPosition, lang) })}</ThemedText> : null}
      {reveal ? (
        <ThemedText type="smallBold" style={{ color: theme.brandText }}>
          {t('matches.roomIn', { time: reveal })}
        </ThemedText>
      ) : null}
      {note ? <Notice tone={note.tone} text={note.text} /> : null}
      {splittable ? <Button title={t('split.action')} variant="outline" onPress={() => router.push({ pathname: '/split/[registrationId]', params: { registrationId: entry.id } })} /> : null}
      {actions.length ? (
        <View style={styles.actions}>
          {actions.map((a) => (
            <View key={a} style={a === 'withdraw' ? styles.secondary : styles.primary}>
              <Button title={t(`matches.actions.${a}`)} variant={a === 'withdraw' || a === 'result' ? 'outline' : 'primary'} busy={busy === a} onPress={press[a]} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}


const styles = StyleSheet.create({
  list: { padding: 16, gap: 12, flexGrow: 1 },
  card: { borderWidth: 1.5, padding: 16, gap: 8 },
  row: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  title: { fontSize: 18, lineHeight: 26, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  primary: { flexGrow: 1, minWidth: 140 },
  secondary: { flexGrow: 1, minWidth: 120 },
});
