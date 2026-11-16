import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Segments } from '@/components/esports';
import { Icon } from '@/components/icons/Icon';
import { ChoiceChips, Sheet } from '@/components/sheet';
import { ThemedText } from '@/components/themed-text';
import { EmptyState, Notice, SkeletonList } from '@/components/ui';
import { useTabBarInset } from '@/hooks/use-tab-bar-inset';
import { Radius } from '@/constants/motion';
import { useTheme } from '@/hooks/use-theme';
import { errorText } from '@/lib/errors';
import { named } from '@/lib/esports';
import { leaderboard, listGames } from '@/lib/esports-api';
import { count, type Lang } from '@/lib/format';
import { points, seasonLabel, type LeaderRow } from '@/lib/player';
import { useMe } from '@/lib/use-me';
import { displayFace } from '@/constants/fonts';

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
  const [picker, setPicker] = useState(false);
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
            // Seasons pile up every quarter: a picker button and a sheet instead of a sideways row.
            <View style={styles.pad}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t('ranks.season')}: ${seasonLabel(season ?? data.seasonKey, lang)}`}
                onPress={() => setPicker(true)}
                style={({ pressed }) => [styles.picker, { borderColor: theme.line, backgroundColor: theme.backgroundElement }, pressed && { opacity: 0.8 }]}>
                <Icon name="calendar-check" size={18} color={theme.text} />
                <ThemedText type="smallBold" style={{ flex: 1 }}>
                  {seasonLabel(season ?? data.seasonKey, lang)}
                </ThemedText>
                <Icon name="chevron-right" size={18} color={theme.textSecondary} style={{ transform: [{ rotate: '90deg' }] }} />
              </Pressable>
              <Sheet visible={picker} onClose={() => setPicker(false)} title={t('ranks.chooseSeason')}>
                <ChoiceChips label={t('ranks.season')} items={data.seasons.map((s) => ({ key: s, label: seasonLabel(s, lang) }))} value={season ?? data.seasonKey} onChange={(k) => (setSeason(k), setPicker(false))} />
              </Sheet>
            </View>
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
      ListEmptyComponent={board.isLoading ? <SkeletonList rows={6} height={56} label={t('common.loading')} /> : <EmptyState icon="ranks" title={t('ranks.emptyTitle')} text={t('ranks.empty')} action={{ title: t('ranks.emptyAction'), onPress: () => router.push('/events') }} />}
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
      <View style={[styles.rank, { borderColor: top ? theme.accent : theme.line, backgroundColor: row.rank === 1 ? theme.accent : top ? theme.accentSoft : 'transparent' }]}>
        <ThemedText type="smallBold" style={{ color: row.rank === 1 ? theme.onAccent : top ? theme.accentText : theme.text }}>
          {count(row.rank, lang)}
        </ThemedText>
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
      <View style={{ alignItems: 'flex-end' }}>
        <ThemedText style={styles.points}>{points(row.points)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('ranks.points')}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 8 },
  picker: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: Radius.control, borderWidth: 1 },
  rule: { paddingHorizontal: 16, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, minHeight: 64 },
  points: { ...displayFace, fontSize: 18, lineHeight: 22 },
  rank: { width: 36, height: 36, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
});
