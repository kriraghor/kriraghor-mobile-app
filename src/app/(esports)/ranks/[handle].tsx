import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Pill } from '@/components/esports';
import { ThemedText } from '@/components/themed-text';
import { Avatar, Notice, ScreenLoading, Stat } from '@/components/ui';
import { useTabBarInset } from '@/hooks/use-tab-bar-inset';
import { useTheme } from '@/hooks/use-theme';
import { errorText } from '@/lib/errors';
import { named } from '@/lib/esports';
import { playerPage } from '@/lib/esports-api';
import { count, type Lang } from '@/lib/format';
import { points } from '@/lib/player';
import { Radius } from '@/constants/motion';
import { displayFace } from '@/constants/fonts';
import { initials } from '@/lib/ui-logic';

/** A player's public page (M21-FR-28): totals and one block per game. Game IDs are always masked. */
export default function PlayerScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const theme = useTheme();
  const tabInset = useTabBarInset();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const page = useQuery({ queryKey: ['player', handle], queryFn: () => playerPage(handle) });

  if (page.isLoading) return <ScreenLoading />;
  const p = page.data;
  if (!p) return <Notice tone="error" text={page.error ? errorText(t, page.error) : t('player.notFound')} />;
  const heading = p.games[0]?.ign ?? p.displayName;

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={[styles.page, { paddingBottom: 24 + tabInset }]} refreshControl={<RefreshControl refreshing={page.isRefetching} onRefresh={() => void page.refetch()} tintColor={theme.brand} />}>
      <Stack.Screen options={{ title: heading }} />
      <View style={styles.who}>
        <Avatar letters={initials(heading)} size={60} />
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.title} numberOfLines={2} accessibilityRole="header">
            {heading}
          </ThemedText>
          {p.username ? <ThemedText themeColor="textSecondary">@{p.username}</ThemedText> : null}
        </View>
      </View>
      <View style={styles.tiles}>
        <Stat label={t('player.events')} value={count(p.tournaments, lang)} />
        <Stat label={t('player.wins')} value={count(p.wins, lang)} tone={p.wins > 0 ? 'prize' : 'text'} />
        <Stat label={t('player.kills')} value={count(p.kills, lang)} />
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
          <ThemedText type="small" themeColor="textSecondary">
            {count(g.tournaments, lang)} {t('player.events')} · {count(g.wins, lang)} {t('player.wins')} · {count(g.kills, lang)} {t('player.kills')} · {points(g.points)} {t('ranks.points')}
          </ThemedText>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 10 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { ...displayFace, fontSize: 26, lineHeight: 32 },
  tiles: { flexDirection: 'row', gap: 8, marginVertical: 6 },
  game: { borderWidth: 1, padding: 14, gap: 4, borderRadius: Radius.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
