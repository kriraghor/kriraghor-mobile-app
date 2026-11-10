import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Pill, SectionTitle, Segments } from '@/components/esports';
import { Card, ErrorNotice, GymGate } from '@/components/gym';
import { ThemedText } from '@/components/themed-text';
import { Button, EmptyState, Notice } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { ApiError, idempotencyKey } from '@/lib/esports-api';
import { count, type Lang } from '@/lib/format';
import { byDay, classAction, dateOnly, linkedGyms, timeOnly } from '@/lib/gym';
import { bookClass, cancelClassBooking, myClasses, type ClassSession } from '@/lib/gym-api';
import { useMyGyms } from '@/lib/use-gym';
import { keys } from '@/lib/use-realtime';

/**
 * My classes (M27-FR-48 to FR-50, mirrors gym.kriraghor.com /me/classes): the coming sessions at my
 * gym with the places left; Book takes a place, or joins the waitlist when they are all taken; Cancel
 * gives the place back until the gym's cutoff. With several gyms, one gym at a time (?m= picks it).
 */
export default function GymClassesScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const { status } = useAuth();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ m?: string }>();
  const gyms = useMyGyms();
  const [chosen, setChosen] = useState<string | null>(params.m ?? null);
  const linked = linkedGyms(gyms.data?.items ?? []);
  const member = linked.find((m) => m.memberId === chosen) ?? linked[0];
  const memberId = member?.memberId ?? '';
  const classes = useQuery({ queryKey: keys.gymClasses(memberId), queryFn: () => myClasses(memberId), enabled: status === 'signed_in' && !!memberId });
  const bookKeys = useRef(new Map<string, string>());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [note, setNote] = useState<string | null>(null);

  if (status !== 'signed_in' || gyms.isLoading) return <GymGate loading={gyms.isLoading} />;
  if (!member) return <EmptyState icon="gym" text={t('gymClasses.noGym')} action={{ title: t('gym.findGym'), onPress: () => router.push('/gyms') }} />;

  const act = async (s: ClassSession, run: () => Promise<string>) => {
    if (busy) return;
    setBusy(s.id);
    setError(null);
    setNote(null);
    try {
      setNote(await run());
      void qc.invalidateQueries({ queryKey: keys.gymClasses(memberId) });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };
  // A retry after a network failure reuses the key; an answer from the API (or success) starts a new one.
  const book = (s: ClassSession) =>
    act(s, async () => {
      const key = bookKeys.current.get(s.id) ?? idempotencyKey('gymclass');
      bookKeys.current.set(s.id, key);
      try {
        const b = await bookClass(s.id, memberId, key);
        bookKeys.current.delete(s.id);
        return b.status === 'waitlisted' ? t('gymClasses.waitlisted') : t('gymClasses.booked');
      } catch (err) {
        if (err instanceof ApiError) bookKeys.current.delete(s.id);
        throw err;
      }
    });
  const cancel = (s: ClassSession) =>
    act(s, async () => {
      await cancelClassBooking(s.myBooking?.id ?? '');
      return t('gymClasses.cancelled');
    });

  const days = byDay(classes.data?.items ?? []);
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={classes.isRefetching} onRefresh={() => void classes.refetch()} tintColor={theme.brand} />}>
      {linked.length > 1 ? (
        <View style={{ marginHorizontal: -16 }}>
          <Segments items={linked.map((m) => ({ key: m.memberId, label: m.gym?.name ?? m.memberCode }))} value={member.memberId} onChange={setChosen} />
        </View>
      ) : null}
      <ThemedText type="small" themeColor="textSecondary">
        {t('gymClasses.lead')}
      </ThemedText>
      {note ? <Notice text={note} /> : null}
      <ErrorNotice error={error ?? classes.error} onRetry={classes.error ? () => void classes.refetch() : undefined} />
      {!classes.isLoading && !days.length && !classes.error ? (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            {t('gymClasses.none')}
          </ThemedText>
        </Card>
      ) : null}
      {days.map((d) => (
        <View key={d.date} style={{ gap: 8 }}>
          <SectionTitle>{dateOnly(d.date, lang, { weekday: true, year: false })}</SectionTitle>
          {d.items.map((s) => (
            <SessionCard key={s.id} s={s} busy={busy === s.id} disabled={busy !== null} onBook={() => void book(s)} onCancel={() => void cancel(s)} />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

function SessionCard({ s, busy, disabled, onBook, onCancel }: { s: ClassSession; busy: boolean; disabled: boolean; onBook: () => void; onCancel: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const action = classAction(s);
  const mine = s.myBooking?.status;
  const facts = [s.trainer?.displayName, s.room, s.spaces > 0 ? t('gymClasses.spaces', { n: count(s.spaces, lang) }) : t('gymClasses.full')].filter(Boolean).join(' · ');
  return (
    <Card muted={s.status === 'cancelled'}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold" style={{ fontSize: 16 }}>
            {s.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('gymClasses.fromTo', { from: timeOnly(s.startsAt, lang), to: timeOnly(s.endsAt, lang) })}
          </ThemedText>
        </View>
        {s.status === 'cancelled' ? <Pill text={t('gymClasses.sessionCancelled')} tone="danger" /> : mine === 'booked' ? <Pill text={t('gymClasses.mine')} tone="brand" /> : mine === 'waitlisted' ? <Pill text={t('gymClasses.onWaitlist')} /> : null}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {facts}
      </ThemedText>
      {s.status === 'cancelled' && s.cancelReason ? <ThemedText type="small">{s.cancelReason}</ThemedText> : null}
      {action === 'book' ? <Button title={t('gymClasses.book')} busy={busy} disabled={disabled} onPress={onBook} /> : null}
      {action === 'waitlist' ? <Button title={t('gymClasses.joinWaitlist')} variant="outline" busy={busy} disabled={disabled} onPress={onBook} /> : null}
      {action === 'cancel' ? <Button title={t('gymClasses.cancel')} variant="outline" busy={busy} disabled={disabled} onPress={onCancel} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12, paddingBottom: 40 },
  head: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
});
