import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EventCard } from '@/components/esports';
import { Icon, type IconName } from '@/components/icons/Icon';
import { SectionsChip } from '@/components/sections';
import { ThemedText } from '@/components/themed-text';
import { PhotoTint } from '@/components/photo-tile';
import { AnimatedPressable, Button, Reveal, SectionHeading, Skeleton } from '@/components/ui';
import { displayFace } from '@/constants/fonts';
import { Radius } from '@/constants/motion';
import { SECTION_PHOTOS } from '@/constants/section-photos';
import { useTabBarInset } from '@/hooks/use-tab-bar-inset';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { config } from '@/lib/config';
import { named } from '@/lib/esports';
import { listEvents, topPlayers } from '@/lib/esports-api';
import { count, type Lang } from '@/lib/format';
import { points } from '@/lib/player';

/**
 * Esports Home (UI v2): All sections, the pitch with its two actions, the tournaments open now (so a
 * guest sees real ones at once, not only a sign-in button), top players, and how it works in three steps.
 */
export default function EsportsHome() {
  const theme = useTheme();
  const qc = useQueryClient();
  const tabInset = useTabBarInset();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { status } = useAuth();
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={[styles.page, { paddingTop: insets.top + 12, paddingBottom: 24 + tabInset }]} refreshControl={<RefreshControl refreshing={false} onRefresh={() => void qc.invalidateQueries({ queryKey: ['top-players'] })} tintColor={theme.brand} />}>
      <SectionsChip />
      <Reveal style={[styles.hero, { backgroundColor: theme.band }]}>
        <Image source={SECTION_PHOTOS.esports} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} accessible={false} />
        <PhotoTint strength={1.1} />
        <ThemedText type="eyebrow" style={{ color: theme.accent }}>
          {t('home.heroKicker')}
        </ThemedText>
        <ThemedText style={[styles.title, { color: '#FFFFFF' }]}>{t('home.heroTitle')}</ThemedText>
        <ThemedText style={[styles.title, { color: theme.accent }]}>{t('home.heroPrize')}</ThemedText>
        <ThemedText style={[styles.sub, { color: '#FFFFFF' }]}>{t('home.heroSub')}</ThemedText>
      </Reveal>
      <View style={styles.actions}>
        <Button title={t('home.find')} variant="accent" icon="events" onPress={() => router.push('/events')} />
        {status === 'signed_in' ? (
          <Button title={t('home.myAccount')} variant="secondary" onPress={() => router.push('/account')} />
        ) : (
          <Button title={t('common.signIn')} variant="secondary" icon="sign-in" onPress={() => router.push('/sign-in')} />
        )}
      </View>
      <OpenNow />
      <TopPlayers />
      <HowItWorks />
      {config.appEnv !== 'production' ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.env}>
          {config.appEnv} · {config.apiUrl}
        </ThemedText>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, gap: 24 },
  hero: { padding: 24, paddingTop: 88, gap: 4, borderRadius: Radius.card, overflow: 'hidden' },
  title: { ...displayFace, fontSize: 34, lineHeight: 40 },
  sub: { marginTop: 8, fontSize: 16, lineHeight: 24 },
  actions: { gap: 12 },
  env: { textAlign: 'center' },
});

/** The tournaments taking registrations now: up to three, with a way to all of them. Loading shows their shape. */
function OpenNow() {
  const theme = useTheme();
  const { t } = useTranslation();
  const open = useQuery({ queryKey: ['hub', 'open-events'], queryFn: () => listEvents('open'), staleTime: 60_000 });
  return (
    <View style={{ gap: 12 }}>
      <SectionHeading title={t('home.openNow')} action={{ title: t('home.seeAll'), onPress: () => router.push('/events') }} />
      {open.isLoading ? (
        <Skeleton height={132} radius={Radius.card} />
      ) : open.data?.length ? (
        open.data.slice(0, 3).map((event, i) => (
          <Reveal key={event.id} index={i}>
            <EventCard event={event} />
          </Reveal>
        ))
      ) : (
        <View style={[howStyles.card, { borderColor: theme.line, backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">{t('home.noneOpen')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('home.noneOpenBody')}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const STEPS: { key: 'uid' | 'join' | 'win'; icon: IconName }[] = [
  { key: 'uid', icon: 'id-card' },
  { key: 'join', icon: 'events' },
  { key: 'win', icon: 'wallet' },
];

/** How it works, in three steps: the answer to "what do I do first?" for someone new. */
function HowItWorks() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  return (
    <View style={{ gap: 12 }}>
      <SectionHeading title={t('home.howTitle')} />
      {STEPS.map((s, i) => (
        <Reveal key={s.key} index={i}>
          <View style={[howStyles.card, howStyles.step, { borderColor: theme.line, backgroundColor: theme.backgroundElement }]}>
            <View style={[howStyles.number, { backgroundColor: theme.accentSoft }]}>
              <ThemedText style={[howStyles.numberText, { color: theme.accentText }]}>{count(i + 1, lang)}</ThemedText>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <ThemedText type="smallBold">{t(`home.how.${s.key}.title`)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t(`home.how.${s.key}.body`)}
              </ThemedText>
            </View>
            <Icon name={s.icon} size={24} color={theme.textSecondary} />
          </View>
        </Reveal>
      ))}
    </View>
  );
}

const howStyles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Radius.card, padding: 16, gap: 4 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  number: { width: 40, height: 40, borderRadius: Radius.control, alignItems: 'center', justifyContent: 'center' },
  numberText: { ...displayFace, fontSize: 20, lineHeight: 26 },
});

/** Top players (M21-FR-28): the best rolling ranks across games; one player can appear once per game. */
function TopPlayers() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const top = useQuery({ queryKey: ['top-players'], queryFn: topPlayers, staleTime: 300_000 });
  if (!top.data?.length) return null;
  return (
    <View style={{ gap: 8 }}>
      <SectionHeading title={t('ranks.topPlayers')} action={{ title: t('home.seeAll'), onPress: () => router.push('/ranks') }} />
      {top.data.map((p, i) => (
        <Reveal key={`${p.userId}-${p.game.key}`} index={i}>
        <AnimatedPressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/ranks/[handle]', params: { handle: p.username ?? p.userId } })}
          style={[topStyles.row, { borderColor: theme.line, backgroundColor: theme.backgroundElement }]}>
          <View style={[topStyles.rank, { borderColor: p.rank <= 3 ? theme.prize : theme.line }]}>
            <ThemedText type="smallBold">{count(p.rank, lang)}</ThemedText>
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {p.displayName ?? p.username}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {named({ nameEn: p.game.nameEn, nameBn: p.game.nameBn ?? p.game.nameEn }, lang)}
            </ThemedText>
          </View>
          <ThemedText type="smallBold">
            {points(p.points)} {t('ranks.points')}
          </ThemedText>
        </AnimatedPressable>
        </Reveal>
      ))}
    </View>
  );
}

const topStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: Radius.control, padding: 12, minHeight: 56 },
  rank: { width: 32, height: 32, borderWidth: 2, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
