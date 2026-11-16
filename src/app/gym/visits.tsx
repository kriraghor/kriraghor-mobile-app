import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Pill, SectionTitle } from '@/components/esports';
import { Card, confirmAction, ErrorNotice, GymGate } from '@/components/gym';
import { ThemedText } from '@/components/themed-text';
import { Button, IntroCard, Notice } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import type { Lang } from '@/lib/format';
import { clockTime, codeGroups, dateOnly, splitVisits } from '@/lib/gym';
import { cancelVisit, myVisits, type MyVisit } from '@/lib/gym-api';
import { keys } from '@/lib/use-realtime';
import { displayFace } from '@/constants/fonts';

/**
 * My visits (M24-FR-112, mirrors gym.kriraghor.com /me/visits): a booked free visit with its QR and
 * 6-character code for the front desk, Cancel until the gym's cutoff, and the earlier visits. A visit
 * is free: nothing is paid here or at the desk.
 */
export default function GymVisitsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { status } = useAuth();
  const qc = useQueryClient();
  const visits = useQuery({ queryKey: keys.gymVisits, queryFn: myVisits, enabled: status === 'signed_in' });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [note, setNote] = useState<string | null>(null);

  if (status !== 'signed_in' || visits.isLoading) return <GymGate loading={visits.isLoading} />;
  const { coming, past } = splitVisits(visits.data ?? []);

  const cancel = (v: MyVisit) =>
    confirmAction(t('gymVisits.cancelTitle'), t('gymVisits.cancelBody', { gym: v.gym?.name ?? t('gym.gym') }), t('gymVisits.cancel'), t('gymVisits.keep'), async () => {
      setBusy(v.id);
      setError(null);
      setNote(null);
      try {
        await cancelVisit(v.id);
        setNote(t('gymVisits.cancelled'));
        void qc.invalidateQueries({ queryKey: keys.gymVisits });
      } catch (err) {
        setError(err);
      } finally {
        setBusy(null);
      }
    });

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={visits.isRefetching} onRefresh={() => void visits.refetch()} tintColor={theme.brand} />}>
      <ThemedText type="small" themeColor="textSecondary">
        {t('gymVisits.lead')}
      </ThemedText>
      {note ? <Notice text={note} /> : null}
      <ErrorNotice error={error ?? visits.error} onRetry={visits.error ? () => void visits.refetch() : undefined} />
      {!coming.length && !past.length && !visits.error ? (
        <IntroCard icon="calendar-check" title={t('gymVisits.none')} text={t('gymVisits.noneBody')}>
          <Button title={t('gym.findGym')} variant="accent" icon="search" onPress={() => router.push('/gyms')} />
        </IntroCard>
      ) : null}
      {coming.map((v) => (
        <Booked key={v.id} v={v} busy={busy === v.id} onCancel={() => cancel(v)} />
      ))}
      {past.length ? (
        <>
          <SectionTitle>{t('gymVisits.history')}</SectionTitle>
          {past.map((v) => (
            <Past key={v.id} v={v} />
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

/** A booked visit: the QR on white for the desk's scanner, the code to read out, and Cancel. */
function Booked({ v, busy, onCancel }: { v: MyVisit; busy: boolean; onCancel: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const { width } = useWindowDimensions();
  const size = Math.max(120, Math.min(width - 96, 260));
  const gym = v.gym?.name ?? t('gym.gym');
  return (
    <Card>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.gym}>{gym}</ThemedText>
          <ThemedText type="smallBold">
            {dateOnly(v.date, lang, { weekday: true })} · {clockTime(v.arriveAt, lang)}
          </ThemedText>
          {v.gym?.addressLine ? (
            <ThemedText type="small" themeColor="textSecondary">
              {v.gym.addressLine}
            </ThemedText>
          ) : null}
        </View>
        <Pill text={t('gymVisits.status.booked')} tone="brand" />
      </View>
      {v.token ? (
        <View style={styles.qrBox} accessible accessibilityLabel={t('gymVisits.qrAlt', { gym })}>
          <QRCode value={v.token} size={size} ecl="M" color="#111210" backgroundColor="#FFFFFF" quietZone={8} />
          {v.code ? (
            <ThemedText style={styles.code} accessibilityLabel={t('gymVisits.codeAria', { code: v.code.split('').join(' ') })}>
              {codeGroups(v.code)}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
      <ThemedText type="small" themeColor="textSecondary">
        {t('gymVisits.howTo')}
      </ThemedText>
      <Button title={t('gymVisits.cancel')} variant="outline" busy={busy} onPress={onCancel} />
    </Card>
  );
}

function Past({ v }: { v: MyVisit }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const status = v.status === 'cancelled' && v.cancelledBy === 'gym' ? t('gymVisits.status.cancelledByGym') : t(`gymVisits.status.${v.status}`);
  return (
    <Card muted>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold">{v.gym?.name ?? t('gym.gym')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {dateOnly(v.date, lang)} · {clockTime(v.arriveAt, lang)}
          </ThemedText>
        </View>
        <Pill text={status} tone={v.status === 'attended' ? 'brand' : v.status === 'booked' ? 'neutral' : 'danger'} />
      </View>
      {v.cancelReason ? <ThemedText type="small">{v.cancelReason}</ThemedText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12, paddingBottom: 40 },
  head: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  gym: { ...displayFace, fontSize: 18, lineHeight: 26 },
  qrBox: { backgroundColor: '#FFFFFF', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, gap: 10 },
  code: { color: '#111210', fontSize: 24, lineHeight: 32, fontWeight: '800', letterSpacing: 3 },
});
