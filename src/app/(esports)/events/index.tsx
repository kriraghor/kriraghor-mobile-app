import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { EventCard, Segments } from '@/components/esports';
import { EmptyState, Notice, Reveal, SkeletonList } from '@/components/ui';
import { useTabBarInset } from '@/hooks/use-tab-bar-inset';
import { useTheme } from '@/hooks/use-theme';
import { errorText } from '@/lib/errors';
import { named, type StatusGroup } from '@/lib/esports';
import { listEvents, listGames } from '@/lib/esports-api';
import { keys } from '@/lib/use-realtime';

const GROUPS: StatusGroup[] = ['open', 'upcoming', 'live', 'finished'];

/** Events (M21 §4.3): open first, then upcoming, live and finished; filter by game. */
export default function EventsScreen() {
  const theme = useTheme();
  const tabInset = useTabBarInset();
  const { t, i18n } = useTranslation();
  const [group, setGroup] = useState<StatusGroup>('open');
  const [game, setGame] = useState<string>('all');
  const games = useQuery({ queryKey: ['games'], queryFn: listGames, staleTime: 3600_000 });
  const events = useQuery({ queryKey: keys.events(group, game), queryFn: () => listEvents(group, game === 'all' ? undefined : game) });

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <FlatList
        data={events.data ?? []}
        keyExtractor={(e) => e.id}
        contentContainerStyle={[styles.list, { paddingBottom: 24 + tabInset }]}
        refreshControl={<RefreshControl refreshing={events.isRefetching} onRefresh={() => void events.refetch()} tintColor={theme.brand} />}
        ListHeaderComponent={
          <View style={styles.filters}>
            <Segments items={GROUPS.map((g) => ({ key: g, label: t(`events.groups.${g}`) }))} value={group} onChange={setGroup} />
            {(games.data?.length ?? 0) > 1 ? (
              <Segments items={[{ key: 'all', label: t('events.allGames') }, ...(games.data ?? []).map((g) => ({ key: g.key, label: named(g, i18n.language) }))]} value={game} onChange={setGame} />
            ) : null}
            {events.error ? (
              <View style={styles.notice}>
                <Notice tone="error" text={errorText(t, events.error)} />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={events.isLoading ? <SkeletonList rows={3} height={200} label={t('common.loading')} /> : <EmptyState icon="events" action={group !== 'open' ? { title: t('events.groups.open'), onPress: () => setGroup('open') } : undefined} text={group === 'open' ? t('events.empty') : t('events.emptyGroup')} />}
        renderItem={({ item, index }) => (
          <Reveal index={index} style={styles.item}>
            <EventCard event={item} />
          </Reveal>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 24, flexGrow: 1 },
  filters: {},
  notice: { paddingHorizontal: 16, paddingBottom: 12 },
  item: { paddingHorizontal: 16, paddingBottom: 12 },
  loading: { marginTop: 48 },
});
