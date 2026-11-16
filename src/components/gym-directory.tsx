import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { ErrorNotice } from '@/components/gym';
import { Icon } from '@/components/icons/Icon';
import { ChoiceChips, Sheet, SheetSection } from '@/components/sheet';
import { ThemedText } from '@/components/themed-text';
import { AnimatedPressable, Button, EmptyState, Reveal, Skeleton } from '@/components/ui';
import { Radius } from '@/constants/motion';
import { useTheme } from '@/hooks/use-theme';
import { useTabBarInset } from '@/hooks/use-tab-bar-inset';
import { activeFilterCount, GYM_SORTS, gymListParams, NO_FILTERS, openState, PRICE_CAPS, ratingText, searchAreas, type DirectoryFilters } from '@/lib/gym-directory';
import { listAreas, listGyms, type GymCard } from '@/lib/gym-api';
import { count, money, type Lang } from '@/lib/format';
import { displayFace } from '@/constants/fonts';

/**
 * The public gym directory (M20 §4, gym.kriraghor.com /gyms): anyone can browse, no account needed.
 * A short title, then a toolbar: Filters (with a count of active filters) and the sort, both opening
 * one bottom sheet (area, monthly price, sort; Clear and Show N gyms). Filters that are on show as
 * removable chips. Gym cards open the gym's page; more load as the list ends.
 */
export function GymDirectory({ header }: { header?: ReactNode }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const bottom = useTabBarInset();
  const [filters, setFilters] = useState<DirectoryFilters>(NO_FILTERS);
  const [sheet, setSheet] = useState(false);
  const areas = useQuery({ queryKey: ['gym-areas'], queryFn: listAreas, staleTime: 3_600_000 });
  const gyms = useInfiniteQuery({
    queryKey: ['gyms', filters],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => listGyms(gymListParams({ ...filters, cursor: pageParam })),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = gyms.data?.pages.flatMap((p) => p.items) ?? [];
  const name = (x: { nameEn: string; nameBn: string }) => (lang === 'bn' ? x.nameBn : x.nameEn);
  const area = areas.data?.find((a) => a.id === filters.areaId);
  const active = activeFilterCount(filters);

  const top = (
    <View style={styles.head}>
      {header}
      <Reveal>
        <ThemedText style={styles.title} accessibilityRole="header">
          {t('gymDir.title')}
        </ThemedText>
        <ThemedText themeColor="textSecondary">{t('gymDir.lead')}</ThemedText>
      </Reveal>
      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={active ? t('gymDir.filtersOn', { n: active }) : t('gymDir.filters')}
          onPress={() => setSheet(true)}
          style={({ pressed }) => [styles.tool, { borderColor: active ? theme.brand : theme.line, backgroundColor: theme.backgroundElement }, pressed && { opacity: 0.8 }]}>
          <Icon name="search" size={18} color={theme.text} />
          <ThemedText type="smallBold">{t('gymDir.filters')}</ThemedText>
          {active ? (
            <View style={[styles.count, { backgroundColor: theme.brand }]}>
              <ThemedText type="smallBold" style={{ color: theme.onBrand, fontSize: 12, lineHeight: 16 }}>
                {count(active, lang)}
              </ThemedText>
            </View>
          ) : null}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setSheet(true)}
          style={({ pressed }) => [styles.tool, { borderColor: theme.line, backgroundColor: theme.backgroundElement }, pressed && { opacity: 0.8 }]}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('gymDir.sortLabel')}
          </ThemedText>
          <ThemedText type="smallBold">{t(`gymDir.sort.${filters.sort}`)}</ThemedText>
        </Pressable>
      </View>
      {active ? (
        <View style={styles.applied}>
          {area ? <AppliedChip label={name(area)} onRemove={() => setFilters({ ...filters, areaId: undefined })} /> : null}
          {filters.priceMaxTaka ? <AppliedChip label={t('gymDir.upTo', { price: money(filters.priceMaxTaka * 100, lang) })} onRemove={() => setFilters({ ...filters, priceMaxTaka: undefined })} /> : null}
        </View>
      ) : null}
      <ErrorNotice error={gyms.error} onRetry={() => void gyms.refetch()} />
      {gyms.isLoading ? (
        <View style={{ gap: 12 }} accessible accessibilityLabel={t('common.loading')} accessibilityRole="progressbar">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={330} radius={Radius.card} />
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <>
      <FlatList
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={[styles.list, { paddingBottom: bottom + 16 }]}
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
            <EmptyState icon="gym" text={t('gymDir.empty')} action={active || filters.sort !== 'price' ? { title: t('gymDir.clear'), onPress: () => setFilters(NO_FILTERS) } : undefined} />
          ) : null
        }
        ListFooterComponent={gyms.isFetchingNextPage ? <Skeleton height={330} radius={Radius.card} style={{ marginTop: 12 }} /> : null}
      />
      <FiltersSheet visible={sheet} value={filters} onClose={() => setSheet(false)} onApply={(f) => (setFilters(f), setSheet(false))} />
    </>
  );
}

/** A filter that is on, with a 48 px remove target. */
function AppliedChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('gymDir.remove', { name: label })}
      onPress={onRemove}
      hitSlop={4}
      style={({ pressed }) => [styles.applied1, { backgroundColor: theme.backgroundSelected, borderColor: theme.brand }, pressed && { opacity: 0.8 }]}>
      <ThemedText type="smallBold" style={{ color: theme.brandText }}>
        {label}
      </ThemedText>
      <Icon name="close" size={16} color={theme.brandText} />
    </Pressable>
  );
}

/** The sheet: a draft of the filters, applied with Show N gyms (the API's total for the draft). */
function FiltersSheet({ visible, value, onClose, onApply }: { visible: boolean; value: DirectoryFilters; onClose: () => void; onApply: (f: DirectoryFilters) => void }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const [draft, setDraft] = useState(value);
  const [q, setQ] = useState('');
  // Each opening starts from what is applied.
  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    if (visible) {
      setDraft(value);
      setQ('');
    }
  }
  const areas = useQuery({ queryKey: ['gym-areas'], queryFn: listAreas, staleTime: 3_600_000 });
  const total = useQuery({ queryKey: ['gyms-count', draft], queryFn: () => listGyms(gymListParams(draft, 1)), enabled: visible, staleTime: 60_000 });
  const name = (x: { nameEn: string; nameBn: string }) => (lang === 'bn' ? x.nameBn : x.nameEn);
  const list = searchAreas(areas.data ?? [], q);
  const n = total.data?.total;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('gymDir.filters')}
      footer={
        <>
          <View style={{ flex: 1 }}>
            <Button title={t('gymDir.clearShort')} variant="outline" onPress={() => setDraft(NO_FILTERS)} />
          </View>
          <View style={{ flex: 2 }}>
            <Button title={typeof n === 'number' ? t('gymDir.showN', { n: count(n, lang) }) : t('gymDir.showGyms')} onPress={() => onApply(draft)} />
          </View>
        </>
      }>
      <SheetSection label={t('gymDir.sortTitle')}>
        <ChoiceChips label={t('gymDir.sortTitle')} items={GYM_SORTS.map((s) => ({ key: s, label: t(`gymDir.sort.${s}`) }))} value={draft.sort} onChange={(k) => setDraft({ ...draft, sort: k as DirectoryFilters['sort'] })} />
      </SheetSection>
      <SheetSection label={t('gymDir.price')}>
        <ChoiceChips
          label={t('gymDir.price')}
          items={[{ key: '', label: t('gymDir.anyPrice') }, ...PRICE_CAPS.map((c) => ({ key: String(c), label: money(c * 100, lang) }))]}
          value={draft.priceMaxTaka ? String(draft.priceMaxTaka) : ''}
          onChange={(k) => setDraft({ ...draft, priceMaxTaka: k ? Number(k) : undefined })}
        />
      </SheetSection>
      <SheetSection label={t('gymDir.area')}>
        {(areas.data?.length ?? 0) > 10 ? (
          <View style={[styles.search, { borderColor: theme.line, backgroundColor: theme.backgroundElement }]}>
            <Icon name="search" size={18} color={theme.textSecondary} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={t('gymDir.searchArea')}
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel={t('gymDir.searchArea')}
              autoCorrect={false}
              style={[styles.searchInput, { color: theme.text }]}
            />
          </View>
        ) : null}
        <ChoiceChips label={t('gymDir.area')} items={[{ key: '', label: t('gymDir.anyArea') }, ...list.map((a) => ({ key: a.id, label: name(a) }))]} value={draft.areaId ?? ''} onChange={(k) => setDraft({ ...draft, areaId: k || undefined })} />
      </SheetSection>
    </Sheet>
  );
}

/** A gym card: cover, open now, name, area, rating, the day and monthly price. */
export function GymCardItem({ card }: { card: GymCard }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const rating = ratingText(card.ratingAvg, card.ratingCount);
  const open = openState(card);
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
          <ThemedText type="smallBold" style={{ color: open.key === 'openNow' ? theme.brandText : theme.textSecondary }}>
            {open.key === 'closedToday' ? t('gymDir.closedToday', { title: open.title }) : t(`gymDir.${open.key}`)}
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
  toolbar: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tool: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, borderRadius: Radius.pill, borderWidth: 1 },
  count: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  applied: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  applied1: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: Radius.pill, borderWidth: 1 },
  search: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: Radius.control, borderWidth: 1 },
  searchInput: { flex: 1, minHeight: 46, fontSize: 16 },
  title: { ...displayFace, fontSize: 28, lineHeight: 36 },
  card: { borderWidth: 1, borderRadius: Radius.card, overflow: 'hidden' },
  cover: { width: '100%', aspectRatio: 16 / 9 },
  noCover: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { ...displayFace, fontSize: 20, lineHeight: 28 },
  prices: { flexDirection: 'row', gap: 16, marginTop: 8 },
  price: { ...displayFace, fontSize: 18, lineHeight: 26 },
});
