import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/icons/Icon';
import { Radius } from '@/constants/motion';
import { ThemedText } from '@/components/themed-text';
import { EmptyState, Notice, SkeletonList } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { errorText } from '@/lib/errors';
import { listNotifications, markAllRead, markRead, type Notice as Item } from '@/lib/esports-api';
import { dateTime, type Lang } from '@/lib/format';
import { linkToRoute } from '@/lib/links';
import { keys } from '@/lib/use-realtime';
import { SignedInOnly } from '@/components/guest';

/** The bell (M08-FR-04, FR-05): newest first, tap to open where it points, mark all read. */
function NotificationsScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const qc = useQueryClient();
  const list = useInfiniteQuery({
    queryKey: keys.notifications,
    queryFn: ({ pageParam }) => listNotifications(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: keys.notifications });
    void qc.invalidateQueries({ queryKey: keys.unread });
  };

  const open = (n: Item) => {
    if (!n.readAt) void markRead([n.id]).then(refresh);
    const to = linkToRoute(n.link);
    if (typeof to !== 'string') void WebBrowser.openBrowserAsync(to.external);
    else if (to !== '/notifications') router.push(to as never);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack.Screen
        options={{
          headerRight: () =>
            items.some((n) => !n.readAt) ? (
              <Pressable accessibilityRole="button" onPress={() => void markAllRead().then(refresh)} style={styles.headerButton}>
                <ThemedText type="smallBold" style={{ color: theme.brandText }}>
                  {t('notifications.markAll')}
                </ThemedText>
              </Pressable>
            ) : null,
        }}
      />
      {list.isLoading ? (
        <SkeletonList rows={6} height={84} label={t('common.loading')} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={theme.brand} />}
          onEndReached={() => list.hasNextPage && void list.fetchNextPage()}
          ListHeaderComponent={list.error ? <Notice tone="error" text={errorText(t, list.error)} /> : null}
          ListEmptyComponent={<EmptyState icon="bell" text={t('notifications.empty')} />}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => open(item)}
              style={({ pressed }) => [styles.item, { borderColor: item.readAt ? 'transparent' : theme.line, backgroundColor: item.readAt ? 'transparent' : theme.backgroundElement }, pressed && { opacity: 0.8 }]}>
              <View style={[styles.mark, { backgroundColor: item.readAt ? theme.backgroundSelected : theme.accentSoft }]}>
                <Icon name="bell" size={20} color={item.readAt ? theme.textSecondary : theme.accentText} active={!item.readAt} />
                {!item.readAt ? <View style={[styles.dot, { backgroundColor: theme.accent, borderColor: theme.backgroundElement }]} accessibilityLabel={t('notifications.unread')} /> : null}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <ThemedText type="smallBold">{item.title}</ThemedText>
                <ThemedText type="small" themeColor={item.readAt ? 'textSecondary' : 'text'}>
                  {item.body}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {dateTime(item.createdAt, lang)}
                </ThemedText>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 1, padding: 12, gap: 8 },
  item: { flexDirection: 'row', gap: 12, padding: 12, borderWidth: 1, borderRadius: Radius.card },
  mark: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: -1, right: -1, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  headerButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
});

/** The person's own page: a guest sees a friendly Sign in (the modal closes back here), never an error. */
export default function NotificationsScreenRoute() {
  return (
    <SignedInOnly>
      <NotificationsScreen />
    </SignedInOnly>
  );
}
