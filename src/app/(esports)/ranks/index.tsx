import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Segments } from '@/components/esports';
import { ThemedText } from '@/components/themed-text';
import { EmptyState, Notice, SkeletonList } from '@/components/ui';
import { useTabBarInset } from '@/hooks/use-tab-bar-inset';
import { useTheme } from '@/hooks/use-theme';
import { errorText } from '@/lib/errors';
import { named } from '@/lib/esports';
import { leaderboard, listGames } from '@/lib/esports-api';
import { count, type Lang } from '@/lib/format';
import { points, seasonLabel, type LeaderRow } from '@/lib/player';
import { useMe } from '@/lib/use-me';

/**
 * Leaderboards (M21-FR-27): per game, the last 90 days (rolling, at least N events) or a season
 * (a Dhaka quarter). Tap a player for their page. The signed-in player's row is marked.
 */
export default function RanksScreen() {
  const theme = useTheme();
  const tabInset = useTabBarInset();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const me = useMe();
  const games = useQuery({ queryKey: ['games'], queryFn: listGames, staleTime: 3600_000 });
  const [game, setGame] = useState<string | null>(null);
  const [scope, setScope] = useState<'rolling' | 'season'>('rolling');
  const [season, setSeason] = useState<string | undefined>(undefined);
  const gameKey = game ?? games.data?.[0]?.key ?? null;
  const board = useQuery({
    queryKey: ['leaderboard', gameKey, scope, season ?? 'current'],
    queryFn: () => leaderboard(gameKey!, scope, season),
    enabled: !!gameKey,
  });

  if (games.isLoading) return <View style={{ flex: 1, backgroundColor: theme.background }}><SkeletonList rows={6} height={56} label={t('common.loading')} /></View>;
  const data = board.data;
  const minEvents = (data as { formula?: { minTournaments?: number } } | undefined)?.formula?.minTournaments ?? 3;

  return (
    <FlatList
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={{ paddingBottom: 24 + tabInset, flexGrow: 1 }}
      data={data?.items ?? []}
      keyExtractor={(r) => r.userId}
      refreshControl={<RefreshControl refreshing={board.isRefetching} onRefresh={() => void board.refetch()} tintColor={theme.brand} />}
      ListHeaderComponent={
        <View>
          {(games.data?.length ?? 0) > 1 ? (
            <Segments items={(games.data ?? []).map((g) => ({ key: g.key, label: named(g, lang) }))} value={gameKey ?? ''} onChange={(k) => (setGame(k), setSeason(undefined))} />
          ) : null}
          <Segments
            items={[
              { key: 'rolling', label: t('ranks.rolling') },
              { key: 'season', label: t('ranks.season') },
            ]}
            value={scope}
            onChange={(k) => setScope(k as 'rolling' | 'season')}
          />
          {scope === 'season' && data?.seasons?.length ? (
            <Segments items={data.seasons.map((s) => ({ key: s, label: seasonLabel(s, lang) }))} value={season ?? data.seasonKey} onChange={setSeason} />
          ) : null}
          {scope === 'rolling' ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.rule}>
              {t('ranks.rule', { min: count(minEvents, lang) })}
            </ThemedText>
          ) : null}
          {board.error ? (
            <View style={styles.pad}>
              <Notice tone="error" text={errorText(t, board.error)} />
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={board.isLoading ? <SkeletonList rows={6} height={56} label={t('common.loading')} /> : <EmptyState text={t('ranks.empty')} />}
      renderItem={({ item }) => <Row row={item} mine={item.userId === me.data?.id} lang={lang} />}
    />
  );
}

function Row({ row, mine, lang }: { row: LeaderRow; mine: boolean; lang: Lang }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const top = row.rank <= 3;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/ranks/[handle]', params: { handle: row.username ?? row.userId } })}
      style={({ pressed }) => [styles.row, { borderBottomColor: theme.line, backgroundColor: mine ? theme.backgroundSelected : theme.background }, pressed && { opacity: 0.8 }]}>
      <View style={[styles.rank, { borderColor: top ? theme.prize : theme.line }]}>
        <ThemedText type="smallBold">{count(row.rank, lang)}</ThemedText>
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {row.ign ?? row.displayName}
          {mine ? ` · ${t('ranks.you')}` : ''}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {row.username ? `@${row.username} · ` : ''}
          {t('ranks.played', { count: row.tournaments })}
        </ThemedText>
      </View>
      <ThemedText type="smallBold">
        {points(row.points)} {t('ranks.points')}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 8 },
  rule: { paddingHorizontal: 16, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, minHeight: 56 },
  rank: { width: 36, height: 36, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
