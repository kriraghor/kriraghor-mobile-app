import { Icon } from '@/components/icons/Icon';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Pill, SectionTitle } from '@/components/esports';
import { Card, ErrorNotice, GymGate } from '@/components/gym';
import { ThemedText } from '@/components/themed-text';
import { Button, IntroCard, Notice } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { dateOnly, requestState, splitRequests } from '@/lib/gym';
import { acceptRequest, cancelRequest, declineRequest, myRequests, type GymRequest } from '@/lib/gym-api';
import type { Lang } from '@/lib/format';
import { usePendingRequests } from '@/lib/use-gym';
import { keys } from '@/lib/use-realtime';
import { displayFace } from '@/constants/fonts';

const SHARES = ['name', 'phone', 'photo', 'checkins', 'payments'] as const;

/**
 * Gym requests (M24-FR-15, FR-16; gym.kriraghor.com /me/requests): a gym's invite to link my account
 * shows the name and member code the gym typed and exactly what the gym will see (Accept, Decline); my
 * own join requests wait for the gym (Cancel); expired ones are greyed. Accepting needs a verified
 * phone (gate join_gym), never NID.
 */
export default function GymRequests() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { status } = useAuth();
  const qc = useQueryClient();
  const pending = usePendingRequests();
  const expired = useQuery({ queryKey: keys.gymRequests('expired'), queryFn: async () => (await myRequests('expired')).items, enabled: status === 'signed_in' });
  const [done, setDone] = useState<{ text: string; memberId?: string } | null>(null);

  if (status !== 'signed_in' || pending.isLoading) return <GymGate loading={pending.isLoading} />;

  const { invites, joins, expired: old } = splitRequests([pending.data, expired.data]);
  const refresh = () => void qc.invalidateQueries({ queryKey: keys.gym });
  const empty = !invites.length && !joins.length && !old.length;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={pending.isRefetching || expired.isRefetching} onRefresh={refresh} tintColor={theme.brand} />}>
      <ThemedText type="small" themeColor="textSecondary">
        {t('gymRequests.lead')}
      </ThemedText>
      <ErrorNotice error={pending.error ?? expired.error} onRetry={refresh} />
      {done ? (
        <View style={{ gap: 8 }}>
          <Notice text={done.text} />
          {done.memberId ? <Button title={t('gymRequests.openMembership')} variant="outline" onPress={() => router.replace({ pathname: '/gym/[memberId]', params: { memberId: done.memberId! } })} /> : null}
        </View>
      ) : null}
      {empty && !pending.error ? (
        <IntroCard icon="download" title={t('gymRequests.none')} text={t('gymRequests.noneBody')}>
          <Button title={t('gym.findGym')} variant="secondary" icon="search" onPress={() => router.push('/gyms')} />
        </IntroCard>
      ) : null}
      {invites.map((r) => (
        <RequestCard key={r.id} r={r} onDone={setDone} />
      ))}
      {joins.length ? <SectionTitle>{t('gymRequests.mine')}</SectionTitle> : null}
      {joins.map((r) => (
        <RequestCard key={r.id} r={r} onDone={setDone} />
      ))}
      {old.length ? <SectionTitle>{t('gymRequests.expiredTitle')}</SectionTitle> : null}
      {old.map((r) => (
        <RequestCard key={r.id} r={r} onDone={setDone} />
      ))}
    </ScrollView>
  );
}

function RequestCard({ r, onDone }: { r: GymRequest; onDone: (d: { text: string; memberId?: string }) => void }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const qc = useQueryClient();
  const [busy, setBusy] = useState<'accept' | 'decline' | 'cancel' | null>(null);
  const [error, setError] = useState<unknown>(null);
  const view = requestState(r);
  const gym = r.gym?.name ?? t('gym.gym');

  async function act(kind: 'accept' | 'decline' | 'cancel') {
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'accept') {
        const res = await acceptRequest(r.id);
        onDone({ text: t('gymRequests.accepted', { gym }), memberId: res.memberId });
      } else if (kind === 'decline') {
        await declineRequest(r.id);
        onDone({ text: t('gymRequests.declined') });
      } else {
        await cancelRequest(r.id);
        onDone({ text: t('gymRequests.cancelled') });
      }
      await qc.invalidateQueries({ queryKey: keys.gym });
    } catch (err) {
      setError(err);
      void qc.invalidateQueries({ queryKey: keys.gym }); // an answered or expired request leaves the list
    } finally {
      setBusy(null);
    }
  }

  const tone = view === 'answer' || view === 'cancel' || view === 'waiting_gym' ? 'prize' : 'neutral';
  return (
    <Card muted={view === 'expired'}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.gym} numberOfLines={2}>
            {gym}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {r.direction === 'gym_invite'
              ? t('gymRequests.inviteFor', { name: r.displayName ?? '–', code: r.memberCode ?? '–' })
              : t('gymRequests.sentOn', { date: dateOnly(r.createdAt, lang) })}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {view === 'expired' ? t('gymRequests.expiredOn', { date: dateOnly(r.expiresAt, lang) }) : t('gymRequests.expires', { date: dateOnly(r.expiresAt, lang) })}
          </ThemedText>
        </View>
        <Pill text={t(`gymRequests.status.${view === 'expired' ? 'expired' : r.status}`)} tone={tone} />
      </View>

      {r.direction === 'gym_invite' && view === 'answer' ? (
        <View style={[styles.shares, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold">{t('gymRequests.willSee')}</ThemedText>
          {(r.shares.length ? r.shares : SHARES).map((s) => (
            <View key={s} style={styles.share}>
              <Icon name="check" size={16} color={theme.brandText} />
              <ThemedText type="small" style={{ flex: 1 }}>
                {(SHARES as readonly string[]).includes(s) ? t(`gymRequests.share.${s as (typeof SHARES)[number]}`) : s}
              </ThemedText>
            </View>
          ))}
          <ThemedText type="small" themeColor="textSecondary">
            {t('gymRequests.neverSee')}
          </ThemedText>
        </View>
      ) : null}
      {r.direction === 'join_request' && r.package ? <ThemedText type="small">{t('gymRequests.asked', { title: r.package.title })}</ThemedText> : null}
      {r.direction === 'join_request' && r.note ? (
        <ThemedText type="small" style={[styles.note, { backgroundColor: theme.backgroundSelected }]}>
          {r.note}
        </ThemedText>
      ) : null}
      {view === 'waiting_gym' ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('gymRequests.waitingGym')}
        </ThemedText>
      ) : null}

      <ErrorNotice error={error} />
      {view === 'answer' ? (
        <View style={styles.actions}>
          <View style={{ flex: 1 }}>
            <Button title={t('gymRequests.accept')} busy={busy === 'accept'} disabled={busy !== null} onPress={() => void act('accept')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title={t('gymRequests.decline')} variant="outline" busy={busy === 'decline'} disabled={busy !== null} onPress={() => void act('decline')} />
          </View>
        </View>
      ) : null}
      {view === 'cancel' ? <Button title={t('gymRequests.cancel')} variant="outline" busy={busy === 'cancel'} onPress={() => void act('cancel')} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12, paddingBottom: 32 },
  top: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  gym: { ...displayFace, fontSize: 18, lineHeight: 26 },
  shares: { padding: 12, gap: 6 },
  share: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  note: { padding: 10 },
  actions: { flexDirection: 'row', gap: 8 },
});
