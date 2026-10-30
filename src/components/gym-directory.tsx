import { Icon } from '@/components/icons/Icon';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ErrorNotice } from '@/components/gym';
import { ThemedText } from '@/components/themed-text';
import { AnimatedPressable, Button, Reveal, Skeleton } from '@/components/ui';
import { Radius } from '@/constants/motion';
import { useTheme } from '@/hooks/use-theme';
import { GYM_SORTS, gymListParams, PRICE_CAPS, ratingText, type GymSort } from '@/lib/gym-directory';
import { listAreas, listGyms, type GymCard } from '@/lib/gym-api';
import { count, money, type Lang } from '@/lib/format';

/**
 * The public gym directory (M20 §4, gym.kriraghor.com /gyms): anyone can browse, no account needed.
 * Area and monthly price caps as chips, the sort, and gym cards (cover, open now, rating, the day
 * and monthly price) that open the gym's page. More gyms load as the list ends.
 */
export function GymDirectory({ header }: { header?: ReactNode }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const [areaId, setAreaId] = useState<string | undefined>();
  const [cap, setCap] = useState<number | undefined>();
  const [sort, setSort] = useState<GymSort>('price');
  const areas = useQuery({ queryKey: ['gym-areas'], queryFn: listAreas, staleTime: 3_600_000 });
  const gyms = useInfiniteQuery({
    queryKey: ['gyms', areaId, cap, sort],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => listGyms(gymListParams({ areaId, sort, priceMaxTaka: cap, cursor: pageParam })),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = gyms.data?.pages.flatMap((p) => p.items) ?? [];
  const name = (x: { nameEn: string; nameBn: string }) => (lang === 'bn' ? x.nameBn : x.nameEn);
  const filtered = Boolean(areaId || cap || sort !== 'price');

  const top = (
    <View style={styles.head}>
      {header}
      <Reveal>
        <ThemedText style={styles.title} accessibilityRole="header">
          {t('gymDir.title')}
        </ThemedText>
        <ThemedText themeColor="textSecondary">{t('gymDir.lead')}</ThemedText>
      </Reveal>
      <Chips
        label={t('gymDir.area')}
        items={[{ key: '', label: t('gymDir.anyArea') }, ...(areas.data ?? []).map((a) => ({ key: a.id, label: name(a) }))]}
        value={areaId ?? ''}
        onChange={(k) => setAreaId(k || undefined)}
      />
      <Chips
        label={t('gymDir.price')}
        items={[{ key: '', label: t('gymDir.anyPrice') }, ...PRICE_CAPS.map((c) => ({ key: String(c), label: money(c * 100, lang) }))]}
        value={cap ? String(cap) : ''}
        onChange={(k) => setCap(k ? Number(k) : undefined)}
      />
      <Chips label="" items={GYM_SORTS.map((s) => ({ key: s, label: t(`gymDir.sort.${s}`) }))} value={sort} onChange={(k) => setSort(k as GymSort)} />
      <ErrorNotice error={gyms.error} onRetry={() => void gyms.refetch()} />
      {gyms.isLoading ? (
        <View style={{ gap: 12 }} accessible accessibilityLabel={t('common.loading')} accessibilityRole="progressbar">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={250} radius={Radius.card} />
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.list}
      data={items}
      keyExtractor={(g) => g.id}
      ListHeaderComponent={top}
      renderItem={({ item, index }) => (
        <Reveal index={index % 8}>
          <GymCardItem card={item} />
        </Reveal>
      )}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      onEndReached={() => gyms.hasNextPage && !gyms.isFetchingNextPage && void gyms.fetchNextPage()}
      onEndReachedThreshold={0.5}
      refreshControl={<RefreshControl refreshing={gyms.isRefetching && !gyms.isFetchingNextPage} onRefresh={() => void gyms.refetch()} tintColor={theme.brand} />}
      ListEmptyComponent={
        !gyms.isLoading && !gyms.error ? (
          <View style={styles.empty}>
            <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }}>
              {t('gymDir.empty')}
            </ThemedText>
            {filtered ? <Button title={t('gymDir.clear')} variant="outline" onPress={() => (setAreaId(undefined), setCap(undefined), setSort('price'))} /> : null}
          </View>
        ) : null
      }
      ListFooterComponent={gyms.isFetchingNextPage ? <Skeleton height={250} radius={Radius.card} style={{ marginTop: 12 }} /> : null}
    />
  );
}

/** One row of filter chips (48 px tall, horizontally scrolling). */
function Chips({ label, items, value, onChange }: { label: string; items: { key: string; label: string }[]; value: string; onChange: (key: string) => void }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityRole="radiogroup">
        {items.map((it) => {
          const on = it.key === value;
          return (
            <Pressable
              key={it.key || 'any'}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => onChange(it.key)}
              style={[styles.chip, { borderColor: on ? theme.brand : theme.line, backgroundColor: on ? theme.brand : theme.backgroundElement }]}>
              <ThemedText type="smallBold" style={{ color: on ? theme.onBrand : theme.text }}>
                {it.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** A gym card: cover, open now, name, area, rating, the day and monthly price. */
export function GymCardItem({ card }: { card: GymCard }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const rating = ratingText(card.ratingAvg, card.ratingCount);
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={card.name}
      onPress={() => router.push({ pathname: '/gyms/[slug]', params: { slug: card.slug } })}
      style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.line }]}>
      {card.cover ? (
        <Image source={{ uri: card.cover }} style={styles.cover} contentFit="cover" transition={200} accessible={false} />
      ) : (
        <View style={[styles.cover, styles.noCover, { backgroundColor: theme.backgroundSelected }]}>
          <Icon name="gym" size={40} color={theme.textSecondary} />
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.row}>
          <ThemedText type="smallBold" style={{ color: card.openNow ? theme.brandText : theme.textSecondary }}>
            {card.openNow ? t('gymDir.openNow') : t('gymDir.closedNow')}
          </ThemedText>
          {card.womenOnlyHours ? (
            <ThemedText type="small" themeColor="textSecondary">
              · {t('gymDir.womenOnly')}
            </ThemedText>
          ) : null}
        </View>
        <ThemedText style={styles.name} numberOfLines={2}>
          {card.name}
        </ThemedText>
        <View style={styles.row}>
          {card.area ? (
            <ThemedText type="small" themeColor="textSecondary">
              {lang === 'bn' ? card.area.nameBn : card.area.nameEn}
            </ThemedText>
          ) : null}
          <Icon name="star" size={14} color={theme.prize} />
          <ThemedText type="small" themeColor="textSecondary">
            {rating ? t('gymDir.rating', { avg: rating, n: count(card.ratingCount, lang) }) : t('gymDir.newGym')}
          </ThemedText>
        </View>
        <View style={styles.prices}>
          {card.dayPrice !== null ? <Price label={t('gymDir.dayPass')} value={money(card.dayPrice, lang)} /> : null}
          {card.monthPrice !== null ? <Price label={t('gymDir.monthly')} value={money(card.monthPrice, lang)} /> : null}
        </View>
      </View>
    </AnimatedPressable>
  );
}

function Price({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={styles.price}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 32 },
  head: { gap: 16, marginBottom: 16 },
  title: { fontSize: 28, lineHeight: 36, fontWeight: '800' },
  chip: { minHeight: 48, paddingHorizontal: 16, borderRadius: Radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: Radius.card, overflow: 'hidden' },
  cover: { width: '100%', aspectRatio: 16 / 9 },
  noCover: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: 20, lineHeight: 28, fontWeight: '800' },
  prices: { flexDirection: 'row', gap: 16, marginTop: 8 },
  price: { fontSize: 18, lineHeight: 26, fontWeight: '800' },
  empty: { gap: 16, paddingVertical: 32 },
});
