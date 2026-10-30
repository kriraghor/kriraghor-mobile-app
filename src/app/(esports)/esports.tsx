import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SectionTitle } from '@/components/esports';
import { SectionsChip } from '@/components/sections';
import { ThemedText } from '@/components/themed-text';
import { PhotoTint } from '@/components/photo-tile';
import { AnimatedPressable, Button, Reveal } from '@/components/ui';
import { Radius } from '@/constants/motion';
import { SECTION_PHOTOS } from '@/constants/section-photos';
import { useTabBarInset } from '@/hooks/use-tab-bar-inset';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { config } from '@/lib/config';
import { named } from '@/lib/esports';
import { topPlayers } from '@/lib/esports-api';
import { count, type Lang } from '@/lib/format';
import { points } from '@/lib/player';

/** Esports Home: All sections, the pitch, sign-in, and top players. */
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
      <Reveal style={[styles.hero, { backgroundColor: '#0A1A12' }]}>
        <Image source={SECTION_PHOTOS.esports} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} accessible={false} />
        <PhotoTint />
        <ThemedText style={[styles.title, { color: '#FFFFFF' }]}>{t('home.heroTitle')}</ThemedText>
        <ThemedText style={[styles.title, { color: theme.prize }]}>{t('home.heroPrize')}</ThemedText>
        <ThemedText style={[styles.sub, { color: '#FFFFFF' }]}>{t('home.heroSub')}</ThemedText>
      </Reveal>
      <View style={styles.actions}>
        {status === 'signed_in' ? (
          <Button title={t('home.myAccount')} onPress={() => router.push('/account')} />
        ) : (
          <Button title={t('common.signIn')} onPress={() => router.push('/sign-in')} />
        )}
      </View>
      <TopPlayers />
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
  hero: { padding: 24, paddingTop: 72, gap: 8, borderRadius: Radius.card, overflow: 'hidden' },
  title: { fontSize: 30, lineHeight: 38, fontWeight: '800' },
  sub: { marginTop: 8, fontSize: 16, lineHeight: 24 },
  actions: { gap: 12 },
  env: { textAlign: 'center' },
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
      <SectionTitle>{t('ranks.topPlayers')}</SectionTitle>
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
