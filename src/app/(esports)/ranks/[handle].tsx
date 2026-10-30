import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Pill, SectionTitle } from '@/components/esports';
import { ThemedText } from '@/components/themed-text';
import { Notice } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { errorText } from '@/lib/errors';
import { named } from '@/lib/esports';
import { playerPage } from '@/lib/esports-api';
import { count, type Lang } from '@/lib/format';
import { points } from '@/lib/player';

/** A player's public page (M21-FR-28): totals and one block per game. Game IDs are always masked. */
export default function PlayerScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const page = useQuery({ queryKey: ['player', handle], queryFn: () => playerPage(handle) });

  if (page.isLoading) return <ActivityIndicator color={theme.brand} style={{ flex: 1, backgroundColor: theme.background }} />;
  const p = page.data;
  if (!p) return <Notice tone="error" text={page.error ? errorText(t, page.error) : t('player.notFound')} />;
  const heading = p.games[0]?.ign ?? p.displayName;

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: heading }} />
      <ThemedText style={styles.title}>{heading}</ThemedText>
      {p.username ? <ThemedText themeColor="textSecondary">@{p.username}</ThemedText> : null}
      <View style={styles.tiles}>
        <Tile label={t('player.events')} value={count(p.tournaments, lang)} />
        <Tile label={t('player.wins')} value={count(p.wins, lang)} prize={p.wins > 0} />
        <Tile label={t('player.kills')} value={count(p.kills, lang)} />
      </View>
      {p.games.map((g) => (
        <View key={g.game.key} style={[styles.game, { borderColor: theme.line, backgroundColor: theme.backgroundElement }]}>
          <View style={styles.row}>
            <ThemedText type="smallBold" style={{ flex: 1 }}>
              {named(g.game, lang)}
            </ThemedText>
            <Pill text={g.rank ? t('player.rank', { rank: count(g.rank, lang) }) : t('player.unranked')} tone={g.rank ? 'brand' : 'neutral'} />
          </View>
          <ThemedText type="small">
            {g.ign ?? ''} · {g.uidMasked}
          </ThemedText>
          <SectionTitle>
            {count(g.tournaments, lang)} {t('player.events')} · {count(g.wins, lang)} {t('player.wins')} · {count(g.kills, lang)} {t('player.kills')} · {points(g.points)} {t('ranks.points')}
          </SectionTitle>
        </View>
      ))}
    </ScrollView>
  );
}

function Tile({ label, value, prize }: { label: string; value: string; prize?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.tile, { borderColor: prize ? theme.prize : theme.line, backgroundColor: theme.backgroundElement }]}>
      <ThemedText style={styles.tileValue}>{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 10 },
  title: { fontSize: 26, lineHeight: 34, fontWeight: '800' },
  tiles: { flexDirection: 'row', gap: 8, marginVertical: 6 },
  tile: { flex: 1, borderWidth: 1.5, padding: 12, alignItems: 'center' },
  tileValue: { fontSize: 22, lineHeight: 30, fontWeight: '800' },
  game: { borderWidth: 1.5, padding: 14, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
