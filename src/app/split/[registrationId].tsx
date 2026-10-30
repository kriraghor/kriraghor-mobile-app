import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Button, Notice } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { errorText } from '@/lib/errors';
import { title } from '@/lib/esports';
import { myRegistrations, setPrizeSplit } from '@/lib/esports-api';
import { count, type Lang } from '@/lib/format';
import { canSplit, checkSplit, equalSplit, splitPlayers, type SplitRow } from '@/lib/player';
import { useMe } from '@/lib/use-me';
import { keys } from '@/lib/use-realtime';
import { SignedInOnly } from '@/components/guest';

/**
 * The squad's prize split (M21 §6.5): whole percents per player adding up to 100, set by whoever
 * registered the entry until the event starts. Kill rewards are never split. Without a split the
 * prize is shared equally.
 */
function SplitScreen() {
  const { registrationId } = useLocalSearchParams<{ registrationId: string }>();
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const qc = useQueryClient();
  const me = useMe();
  const entries = useQuery({ queryKey: keys.registrations, queryFn: myRegistrations });
  const entry = entries.data?.find((r) => r.id === registrationId);
  const players = entry ? splitPlayers(entry) : [];
  const [rows, setRows] = useState<SplitRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);

  if (entries.isLoading || me.isLoading) return <ActivityIndicator color={theme.brand} style={{ flex: 1, backgroundColor: theme.background }} />;
  if (!entry) return <Notice tone="error" text={t('common.somethingWrong')} />;

  const ids = players.map((p) => p.userId);
  const current = rows ?? entry.prizeSplit ?? equalSplit(ids);
  const total = current.reduce((n, r) => n + (Number.isFinite(r.pct) ? r.pct : 0), 0);
  const editable = canSplit(entry, me.data?.id);
  const nameOf = (userId: string) => {
    const p = players.find((x) => x.userId === userId);
    return p ? `${p.ign}${p.username ? ` (@${p.username})` : ''}` : userId;
  };

  async function save() {
    const check = checkSplit(current, ids);
    if (!check.ok) return setNote({ tone: 'error', text: check.reason === 'sum' ? t('split.sum') : t('errors.SPLIT_INVALID') });
    setBusy(true);
    setNote(null);
    try {
      await setPrizeSplit(entry!.id, current);
      setNote({ tone: 'info', text: t('split.saved') });
      void qc.invalidateQueries({ queryKey: keys.registrations });
    } catch (err) {
      setNote({ tone: 'error', text: errorText(t, err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <ThemedText style={styles.title}>{entry.tournament ? title(entry.tournament, lang) : ''}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t('split.help')}
      </ThemedText>
      {note ? <Notice tone={note.tone} text={note.text} /> : null}
      {!entry.prizeSplit && !rows ? <ThemedText type="small">{t('split.none')}</ThemedText> : null}

      {current.map((r) => (
        <View key={r.userId} style={[styles.row, { borderColor: theme.line, backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold" style={{ flex: 1 }} numberOfLines={1}>
            {nameOf(r.userId)}
          </ThemedText>
          <TextInput
            accessibilityLabel={`${nameOf(r.userId)} %`}
            editable={editable}
            keyboardType="number-pad"
            maxLength={3}
            value={String(r.pct)}
            onChangeText={(v) => setRows(current.map((x) => (x.userId === r.userId ? { ...x, pct: Number(v.replace(/\D/g, '') || '0') } : x)))}
            style={[styles.input, { color: theme.text, borderColor: theme.line, backgroundColor: theme.background }]}
          />
          <ThemedText type="smallBold">%</ThemedText>
        </View>
      ))}
      <ThemedText type="smallBold" style={{ color: total === 100 ? theme.brandText : theme.danger }}>
        {t('split.total', { total: count(total, lang) })}
      </ThemedText>
      {editable ? (
        <>
          <Button title={t('split.equal')} variant="outline" onPress={() => setRows(equalSplit(ids))} />
          <Button title={t('split.save')} busy={busy} onPress={() => void save()} />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 10 },
  title: { fontSize: 22, lineHeight: 30, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, paddingHorizontal: 12, minHeight: 56 },
  input: { width: 64, minHeight: 44, borderWidth: 2, textAlign: 'right', paddingHorizontal: 8, fontSize: 16 },
});

/** The person's own page: a guest sees a friendly Sign in (the modal closes back here), never an error. */
export default function SplitScreenRoute() {
  return (
    <SignedInOnly>
      <SplitScreen />
    </SignedInOnly>
  );
}
