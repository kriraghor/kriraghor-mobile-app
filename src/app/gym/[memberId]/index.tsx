import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { InfoRow, Pill, SectionTitle } from '@/components/esports';
import { Card, confirmAction, ErrorNotice, GymGate, openWeb, RowLink } from '@/components/gym';
import { BodyCard, PointsCard, TrainerCard, WhatsAppCard } from '@/components/gym-extras';
import { ProgressCard, RenewCard } from '@/components/gym-progress';
import { ThemedText } from '@/components/themed-text';
import { Button, Field, Notice } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { dateOnly, duePayState } from '@/lib/gym';
import { myDues, myMembership, saveHealthNote, unlink, type MemberDue, type Membership } from '@/lib/gym-api';
import { count, money, type Lang } from '@/lib/format';
import { useMyGyms, usePayDue } from '@/lib/use-gym';
import { keys } from '@/lib/use-realtime';
import { displayFace } from '@/constants/fonts';

/**
 * One of my gym memberships (M24 §4.5 gym/[memberId], mirrors /me/memberships/[memberId]): package
 * and period, days left, freeze periods; what is due with Pay (or "Pay at the counter"); payments and
 * receipts (a receipt opens its gym.kriraghor.com/r/[token] page); the check-in calendar; my plans; my
 * health note (shown to the gym's plan writers); my points and my body (M27-FR-61, FR-30); my classes;
 * Renew (M24 §19) and my body progress (M24 §20); my WhatsApp number and consents (M24-FR-159);
 * my trainer with a photo (23 Nov 2026); Unlink with a confirm. Unlinked or left: read-only.
 */
export default function GymMembershipScreen() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const { status } = useAuth();
  const qc = useQueryClient();
  const detail = useQuery({ queryKey: keys.gymMembership(memberId), queryFn: () => myMembership(memberId), enabled: status === 'signed_in' && !!memberId });
  const dues = useQuery({ queryKey: keys.gymDues, queryFn: async () => (await myDues()).items, enabled: status === 'signed_in' });
  const gyms = useMyGyms();
  const payDue = usePayDue();
  const [unlinking, setUnlinking] = useState(false);
  const [note, setNote] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [unlinkError, setUnlinkError] = useState<unknown>(null);

  if (status !== 'signed_in' || detail.isLoading) return <GymGate loading={detail.isLoading} />;
  const refresh = () => void qc.invalidateQueries({ queryKey: keys.gym });
  const d = detail.data;
  if (!d) {
    return (
      <View style={[styles.page, { flex: 1, backgroundColor: theme.background }]}>
        <ErrorNotice error={detail.error} onRetry={() => void detail.refetch()} />
      </View>
    );
  }

  const m = d.member;
  const gymName = m.gym?.name ?? t('gym.gym');
  const readOnly = !m.linked || m.status === 'left' || m.status === 'removed';
  const card = gyms.data?.items.find((g) => g.memberId === memberId);
  const openDues = (dues.data ?? []).filter((x) => x.memberId === memberId);
  const payments = d.dues
    .filter((x): x is MemberDue => x !== null)
    .flatMap((x) => x.payments ?? [])
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const memberships = d.memberships.filter((x): x is Membership => x !== null).sort((a, b) => b.startsOn.localeCompare(a.startsOn));

  const doUnlink = () =>
    confirmAction(t('gymMember.unlinkConfirm', { gym: gymName }), t('gymMember.unlinkBody', { gym: gymName }), t('gymMember.unlink'), t('common.cancel'), async () => {
      setUnlinking(true);
      setUnlinkError(null);
      try {
        await unlink(memberId);
        setNote({ tone: 'info', text: t('gymMember.unlinked', { gym: gymName }) });
        refresh();
      } catch (err) {
        setUnlinkError(err);
      } finally {
        setUnlinking(false);
      }
    });

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={detail.isRefetching} onRefresh={refresh} tintColor={theme.brand} />}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.title}>{gymName}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('gymMember.code', { code: m.memberCode })} · {t('gymMember.joined', { date: dateOnly(m.joinedOn, lang) })}
          </ThemedText>
        </View>
        <Pill text={t(`gym.memberStatus.${m.status}`)} tone={m.status === 'active' ? 'brand' : m.status === 'expired' || m.status === 'removed' ? 'danger' : 'neutral'} />
      </View>
      {note ? <Notice tone={note.tone} text={note.text} /> : null}
      {readOnly ? <Notice text={t('gymMember.readOnly')} /> : null}
      <ErrorNotice error={detail.error} />

      {!readOnly ? (
        <View style={styles.links}>
          <RowLink icon="checkin" label={t('gym.checkinQr')} onPress={() => router.navigate({ pathname: '/gym/checkin', params: { m: memberId } })} />
          <RowLink icon="people" label={t('gymClasses.title')} onPress={() => router.push({ pathname: '/gym/classes', params: { m: memberId } })} />
        </View>
      ) : null}

      {!readOnly && d.trainer ? <TrainerCard trainer={d.trainer} /> : null}
      {!readOnly ? <RenewCard memberId={memberId} dues={openDues} onPay={(dueId) => void payDue.pay(dueId, memberId)} payBusy={payDue.busy} /> : null}
      {!readOnly ? <ProgressCard memberId={memberId} /> : null}
      {!readOnly ? <PointsCard memberId={memberId} /> : null}

      <SectionTitle>{t('gymMember.memberships')}</SectionTitle>
      {!memberships.length ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('gymMember.noMemberships')}
        </ThemedText>
      ) : (
        memberships.map((ms) => <MembershipCard key={ms.id} ms={ms} />)
      )}

      <SectionTitle>{t('gymMember.dues')}</SectionTitle>
      <ErrorNotice error={payDue.error} />
      {!openDues.length ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('gymMember.noDues')}
        </ThemedText>
      ) : (
        openDues.map((due) => {
          const state = readOnly ? { kind: 'counter' as const, reason: null } : duePayState(due);
          return (
            <Card key={due.dueId}>
              <InfoRow label={due.membership?.title ?? t('gymMember.due')} value={money(due.outstandingPoisha, lang)} strong />
              <ThemedText type="small" themeColor="textSecondary">
                {t('gymMember.dueOn', { date: dateOnly(due.dueOn, lang) })}
                {due.paidPoisha > 0 ? ` · ${t('gymMember.paidOf', { paid: money(due.paidPoisha, lang), amount: money(due.amountPoisha, lang) })}` : ''}
              </ThemedText>
              {due.overdue ? <Pill text={t('gymMember.overdue')} tone="danger" /> : null}
              {state.kind === 'online' ? (
                <Button title={t('gym.payAmount', { amount: money(due.outstandingPoisha, lang) })} busy={payDue.busy === due.dueId} disabled={payDue.busy !== null} onPress={() => void payDue.pay(due.dueId, memberId)} />
              ) : state.kind === 'counter' ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('gym.payCounter')}
                  {state.reason ? ` ${t(`gym.offlineWhy.${state.reason}`)}` : ''}
                </ThemedText>
              ) : null}
            </Card>
          );
        })
      )}

      <SectionTitle>{t('gymMember.payments')}</SectionTitle>
      {!payments.length ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('gymMember.noPayments')}
        </ThemedText>
      ) : (
        payments.slice(0, 30).map((p) => (
          <View key={p.id} style={[styles.line, { borderBottomColor: theme.line }]}>
            <View style={{ flex: 1 }}>
              <ThemedText type="smallBold">{money(p.amountPoisha, lang)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {dateOnly(p.paidOn, lang)} · {t(`gymMember.method.${p.method}`)}
                {p.receiptNo ? ` · ${p.receiptNo}` : ''}
              </ThemedText>
            </View>
            {p.reversedById || p.reversesId ? <Pill text={t('gymMember.reversed')} tone="danger" /> : null}
          </View>
        ))
      )}

      <SectionTitle>{t('gymMember.receipts')}</SectionTitle>
      {!d.receipts.length ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('gymMember.noReceipts')}
        </ThemedText>
      ) : (
        d.receipts.map((r) => (
          <RowLink
            key={r.id}
            icon="receipt"
            external
            label={`${r.receiptNo} · ${money(r.amountPoisha, lang)}`}
            hint={r.reversedOn ? t('gymMember.reversedOn', { date: dateOnly(r.reversedOn, lang) }) : dateOnly(r.paidOn, lang)}
            onPress={() => openWeb(r.url)}
          />
        ))
      )}

      <SectionTitle>{t('gymMember.more')}</SectionTitle>
      <RowLink icon="calendar-check" label={t('gymAttendance.title')} onPress={() => router.push({ pathname: '/gym/[memberId]/attendance', params: { memberId } })} />
      {(card?.plans ?? []).map((p) => (
        <RowLink
          key={p.assignmentId}
          icon={p.kind === 'workout' ? 'gym' : 'food'}
          label={p.title}
          hint={t(`gymPlan.kind.${p.kind}`)}
          onPress={() => router.push({ pathname: '/gym/plans/[assignmentId]', params: { assignmentId: p.assignmentId } })}
        />
      ))}

      {!readOnly && m.health ? <BodyCard memberId={memberId} health={m.health} /> : null}
      {!readOnly ? <HealthNote memberId={memberId} text={m.healthNote ?? null} at={m.healthNoteAt ?? null} /> : null}
      {!readOnly ? <WhatsAppCard memberId={memberId} /> : null}

      {!readOnly ? (
        <Card>
          <ThemedText type="smallBold">{t('gymMember.unlinkTitle')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('gymMember.unlinkBody', { gym: gymName })}
          </ThemedText>
          <ErrorNotice error={unlinkError} />
          <Button title={t('gymMember.unlink')} variant="outline" busy={unlinking} onPress={doUnlink} />
        </Card>
      ) : null}
    </ScrollView>
  );
}

/** One package period: dates, days left, and its freezes. */
function MembershipCard({ ms }: { ms: Membership }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const running = ms.status === 'active' || ms.status === 'frozen';
  const tone = ms.status === 'active' ? 'brand' : ms.status === 'cancelled' || ms.status === 'expired' ? 'danger' : 'neutral';
  return (
    <Card muted={!running && ms.status !== 'upcoming'}>
      <View style={styles.head}>
        <ThemedText type="smallBold" style={{ flex: 1 }}>
          {ms.title}
        </ThemedText>
        <Pill text={t(`gymMember.msStatus.${ms.status}`)} tone={tone} />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {t('gymMember.period', { from: dateOnly(ms.startsOn, lang), to: dateOnly(ms.endsOn, lang) })}
      </ThemedText>
      {running ? <ThemedText type="smallBold">{ms.daysLeft > 0 ? t('gym.daysLeft', { n: count(ms.daysLeft, lang) }) : t('gym.lastDay')}</ThemedText> : null}
      {ms.frozenDays > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('gymMember.frozenDays', { n: count(ms.frozenDays, lang) })}
        </ThemedText>
      ) : null}
      {ms.freezes
        .filter((f) => f.status !== 'cancelled')
        .map((f) => (
          <ThemedText key={f.id} type="small" themeColor="textSecondary">
            {t('gymMember.freeze', { from: dateOnly(f.fromOn, lang), to: dateOnly(f.endedEarlyOn ?? f.toOn, lang) })}
          </ThemedText>
        ))}
      {ms.cancelReason ? (
        <ThemedText type="small" themeColor="textSecondary">
          {ms.cancelReason}
        </ThemedText>
      ) : null}
    </Card>
  );
}

/** My health note at this gym (allergies, conditions): shown to the owner and plan writers only. Empty clears it. */
function HealthNote({ memberId, text, at }: { memberId: string; text: string | null; at: string | null }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const qc = useQueryClient();
  const [draft, setDraft] = useState(text ?? '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const save = async () => {
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      await saveHealthNote(memberId, draft.trim() || null);
      setSaved(true);
      void qc.invalidateQueries({ queryKey: keys.gymMembership(memberId) });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <ThemedText type="smallBold">{t('gymMember.healthNote')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t('gymMember.healthNoteBody')}
      </ThemedText>
      <Field label={t('gymMember.healthNoteLabel')} value={draft} onChangeText={(v) => setDraft(v.slice(0, 500))} multiline numberOfLines={4} maxLength={500} />
      {at ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('gymMember.healthNoteAt', { date: dateOnly(at, lang) })}
        </ThemedText>
      ) : null}
      {saved ? <Notice text={t('gymMember.healthNoteSaved')} /> : null}
      <ErrorNotice error={error} />
      <Button title={t('gymMember.healthNoteSave')} variant="outline" busy={busy} disabled={draft.trim() === (text ?? '').trim()} onPress={() => void save()} />
    </Card>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12, paddingBottom: 40 },
  head: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  title: { ...displayFace, fontSize: 22, lineHeight: 30 },
  links: { gap: 8 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
});
