import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SectionTitle } from '@/components/esports';
import { ThemedText } from '@/components/themed-text';
import { Button, Field, Notice } from '@/components/ui';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { errorText } from '@/lib/errors';
import { addEvidence, getMatch, myRegistrations, openDispute, uploadImage } from '@/lib/esports-api';
import { count, dateTime, type Lang } from '@/lib/format';
import { pickImage } from '@/lib/pick-image';
import { keys, useRoomEvents } from '@/lib/use-realtime';

/**
 * A match's result (M21-FR-18 to FR-22): placement, kills and points per entry, with the player's
 * own entry marked, and a dispute with a screenshot while the dispute window is open.
 */
export default function ResultScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const qc = useQueryClient();
  const now = useNow(15_000);
  const match = useQuery({ queryKey: keys.match(matchId), queryFn: () => getMatch(matchId) });
  const mine = useQuery({ queryKey: keys.registrations, queryFn: myRegistrations });
  useRoomEvents(`esports_match:${matchId}`, ['esports.results_posted', 'esports.match_status'], () => void qc.invalidateQueries({ queryKey: keys.match(matchId) }));

  const [reason, setReason] = useState('');
  const [shot, setShot] = useState<{ uri: string; mime: 'image/jpeg' | 'image/png' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  if (match.isLoading) return <ActivityIndicator color={theme.brand} style={{ flex: 1, backgroundColor: theme.background }} />;
  const m = match.data;
  if (!m) return <Notice tone="error" text={errorText(t, match.error)} />;

  const myIds = new Set((mine.data ?? []).map((r) => r.id));
  const rows = [...m.results].sort((a, b) => (a.placement ?? 999) - (b.placement ?? 999));
  const windowOpen = !!m.disputeClosesAt && ['results_pending', 'disputed'].includes(m.status) && now <= Date.parse(m.disputeClosesAt);

  async function send() {
    if (reason.trim().length < 5) return setError(t('result.reason'));
    setBusy(true);
    setError(null);
    try {
      const evidenceIds: string[] = [];
      if (shot) {
        const up = await uploadImage(shot.uri, shot.mime);
        evidenceIds.push((await addEvidence(matchId, { kind: 'screenshot', key: up.key })).id);
      }
      const d = await openDispute(matchId, { reason: reason.trim(), evidenceIds });
      setSent(t('result.sent', { code: d.caseCode }));
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  }

  async function choose() {
    try {
      const img = await pickImage();
      if (img) setShot(img);
    } catch {
      setError(t('gameIds.photosDenied'));
    }
  }

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.page}>
      {!rows.length ? (
        <Notice text={t('result.notPosted')} />
      ) : (
        <View style={[styles.table, { borderColor: theme.line }]}>
          <View style={[styles.tr, styles.head, { backgroundColor: theme.backgroundSelected }]}>
            <Cell w={36} bold>{t('result.rank')}</Cell>
            <Cell flex bold>{t('result.entry')}</Cell>
            <Cell w={52} bold right>{t('result.kills')}</Cell>
            <Cell w={52} bold right>{t('result.points')}</Cell>
          </View>
          {rows.map((r) => {
            const me = myIds.has(r.registrationId);
            return (
              <View key={r.registrationId} style={[styles.tr, { borderTopColor: theme.line, backgroundColor: me ? theme.backgroundSelected : theme.backgroundElement }]}>
                <Cell w={36} bold>{r.placement ? count(r.placement, lang) : '–'}</Cell>
                <Cell flex bold={me}>
                  {r.entry.tag ? `[${r.entry.tag}] ` : ''}
                  {r.entry.name || r.entry.players.map((p) => p.ign).join(', ')}
                  {r.placement === null ? ` · ${t('result.dnp')}` : ''}
                </Cell>
                <Cell w={52} right>{count(r.kills, lang)}</Cell>
                <Cell w={52} right bold>{count(r.totalPoints, lang)}</Cell>
              </View>
            );
          })}
        </View>
      )}

      {m.disputeClosesAt && rows.length ? (
        <>
          <SectionTitle>{t('result.dispute')}</SectionTitle>
          {sent ? (
            <Notice text={sent} />
          ) : windowOpen ? (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                {t('result.disputeUntil', { at: dateTime(m.disputeClosesAt, lang) })}
              </ThemedText>
              {error ? <Notice tone="error" text={error} /> : null}
              <Field label={t('result.reason')} value={reason} onChangeText={setReason} multiline maxLength={500} />
              <Button title={shot ? t('result.screenshotAdded') : t('result.addScreenshot')} variant="outline" onPress={() => void choose()} />
              <Button title={t('result.send')} busy={busy} onPress={() => void send()} />
            </>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              {t('result.disputeClosed')}
            </ThemedText>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

function Cell({ children, w, flex, bold, right }: { children: React.ReactNode; w?: number; flex?: boolean; bold?: boolean; right?: boolean }) {
  return (
    <ThemedText type={bold ? 'smallBold' : 'small'} style={[{ textAlign: right ? 'right' : 'left' }, flex ? { flex: 1 } : { width: w }]} numberOfLines={2}>
      {children}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12 },
  table: { borderWidth: 1.5 },
  tr: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'transparent' },
  head: { borderTopWidth: 0 },
});
