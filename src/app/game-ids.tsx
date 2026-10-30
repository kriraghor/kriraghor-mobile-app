import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Pill, SectionTitle, Segments } from '@/components/esports';
import { ThemedText } from '@/components/themed-text';
import { Button, Field, Notice } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { errorText } from '@/lib/errors';
import { named, type Game } from '@/lib/esports';
import { addProfile, listGames, myProfiles, uploadImage } from '@/lib/esports-api';
import { pickImage } from '@/lib/pick-image';
import { keys } from '@/lib/use-realtime';
import { SignedInOnly } from '@/components/guest';

/**
 * Game IDs (M21-FR-02 to FR-04): one per game, with a screenshot of the in-game profile; staff
 * verify it on the Moderation desk. The ID is checked against the game's pattern here for a quick
 * hint, and again on the server.
 */
function GameIdsScreen() {
  const { game: preselect } = useLocalSearchParams<{ game?: string }>();
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const qc = useQueryClient();
  const games = useQuery({ queryKey: ['games'], queryFn: listGames, staleTime: 3600_000 });
  const profiles = useQuery({ queryKey: keys.profiles, queryFn: myProfiles });
  const [gameKey, setGameKey] = useState<string | null>(preselect ?? null);
  const [uid, setUid] = useState('');
  const [ign, setIgn] = useState('');
  const [shot, setShot] = useState<{ uri: string; mime: 'image/jpeg' | 'image/png' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (games.isLoading || profiles.isLoading) return <ActivityIndicator color={theme.brand} style={{ flex: 1, backgroundColor: theme.background }} />;
  const list = (profiles.data ?? []).filter((p) => p.status !== 'unlinked');
  const taken = new Set(list.filter((p) => p.status !== 'rejected').map((p) => p.gameId));
  const open = (games.data ?? []).filter((g) => !taken.has(g.id));
  const game: Game | undefined = open.find((g) => g.key === gameKey) ?? (open.length === 1 ? open[0] : undefined);

  async function choose() {
    try {
      const img = await pickImage();
      if (img) setShot(img);
    } catch {
      setError(t('gameIds.photosDenied'));
    }
  }

  async function submit() {
    if (!game) return;
    if (!uid.trim() || !ign.trim()) return setError(`${t('gameIds.uid')} · ${t('gameIds.ign')}`);
    if (!shot) return setError(t('gameIds.screenshot'));
    if (!new RegExp(game.uidRegex).test(uid.trim())) return setError(t('errors.ESPORTS_UID_FORMAT'));
    setBusy(true);
    setError(null);
    try {
      const up = await uploadImage(shot.uri, shot.mime);
      await addProfile({ gameId: game.id, uid: uid.trim(), ign: ign.trim(), screenshotKey: up.key });
      setSent(true);
      setUid('');
      setIgn('');
      setShot(null);
      void qc.invalidateQueries({ queryKey: keys.profiles });
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={profiles.isRefetching} onRefresh={() => void profiles.refetch()} tintColor={theme.brand} />}>
      {list.length ? (
        list.map((p) => {
          const g = games.data?.find((x) => x.id === p.gameId);
          return (
            <View key={p.id} style={[styles.card, { borderColor: theme.line, backgroundColor: theme.backgroundElement }]}>
              <View style={styles.row}>
                <ThemedText type="smallBold" style={{ flex: 1 }}>
                  {named(g, lang) || p.gameKey}
                </ThemedText>
                <Pill text={t(`gameIds.status.${p.status}`)} tone={p.status === 'verified' ? 'brand' : p.status === 'pending' ? 'neutral' : 'danger'} />
              </View>
              <ThemedText>
                {p.ign} · {p.uidMasked}
              </ThemedText>
              {p.status === 'rejected' && p.rejectReason ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('gameIds.rejected', { reason: p.rejectReason.replace(/_/g, ' ') })}
                </ThemedText>
              ) : null}
            </View>
          );
        })
      ) : (
        <ThemedText themeColor="textSecondary">{t('gameIds.empty')}</ThemedText>
      )}

      {sent ? <Notice text={t('gameIds.sent')} /> : null}

      {open.length ? (
        <>
          <SectionTitle>
            {t('gameIds.add')}
            {game && open.length === 1 ? ` · ${named(game, lang)}` : ''}
          </SectionTitle>
          {open.length > 1 ? (
            <View style={{ marginHorizontal: -16 }}>
              <Segments items={open.map((g) => ({ key: g.key, label: named(g, lang) }))} value={game?.key ?? ''} onChange={(k) => setGameKey(k)} />
            </View>
          ) : null}
          {game ? (
            <>
              {error ? <Notice tone="error" text={error} /> : null}
              <Field label={lang === 'bn' && game.uidLabelBn ? game.uidLabelBn : game.uidLabelEn || t('gameIds.uid')} value={uid} onChangeText={setUid} keyboardType="number-pad" maxLength={32} />
              <Field label={t('gameIds.ign')} value={ign} onChangeText={setIgn} maxLength={game.ignMaxLen || 40} autoCapitalize="none" />
              <ThemedText type="small" themeColor="textSecondary">
                {t('gameIds.screenshot')}
              </ThemedText>
              {shot ? <Image source={{ uri: shot.uri }} style={styles.preview} contentFit="contain" accessibilityIgnoresInvertColors /> : null}
              <Button title={shot ? t('gameIds.changeScreenshot') : t('gameIds.pickScreenshot')} variant="outline" onPress={() => void choose()} />
              <Button title={t('gameIds.submit')} busy={busy} onPress={() => void submit()} />
            </>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12 },
  card: { borderWidth: 1.5, padding: 14, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  preview: { width: '100%', height: 220 },
});

/** The person's own page: a guest sees a friendly Sign in (the modal closes back here), never an error. */
export default function GameIdsScreenRoute() {
  return (
    <SignedInOnly>
      <GameIdsScreen />
    </SignedInOnly>
  );
}
