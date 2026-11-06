import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image as RNImage, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/icons/Icon';
import { TileFace, tileStyle } from '@/components/photo-tile';
import { ThemedText } from '@/components/themed-text';
import { useZoomScene, ZOOM } from '@/components/transition';
import { AnimatedPressable, Reveal } from '@/components/ui';
import { Radius } from '@/constants/motion';
import { SECTION_PHOTOS } from '@/constants/section-photos';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { config } from '@/lib/config';
import { SECTION_HOME, setStartSection, startSection, tileTarget, TILES, type Tile, type TileKey } from '@/lib/section';
import { openSection } from '@/lib/section-nav';
import { dayPart, firstName, initials } from '@/lib/ui-logic';
import { useMe } from '@/lib/use-me';

const LOGO = { light: require('../../assets/brand/logo-mark.png'), dark: require('../../assets/brand/logo-mark-dark.png') };

const ICONS: Record<TileKey, IconName> = {
  esports: 'esports',
  gym: 'gym',
  venues: 'venues',
  shop: 'shop',
  hire: 'hire',
  events: 'events',
};

/**
 * Six cells, no gaps, with rhythm: Esports (the top priority) as a wide hero, then two rows of two,
 * then Events wide.
 */
const ROWS: { keys: TileKey[]; height: number }[] = [
  { keys: ['esports'], height: 210 },
  { keys: ['gym', 'venues'], height: 176 },
  { keys: ['shop', 'hire'], height: 176 },
  { keys: ['events'], height: 132 },
];
const TILE_BY_KEY = Object.fromEntries(TILES.map((t) => [t.key, t])) as Record<TileKey, Tile>;

/** Decode the section photos before anyone taps, so nothing re-decodes during a transition. */
function prefetchPhotos() {
  try {
    const uris = Object.values(SECTION_PHOTOS)
      .map((m) => RNImage.resolveAssetSource(m)?.uri)
      .filter((u): u is string => Boolean(u));
    void Image.prefetch(uris).catch(() => undefined);
  } catch {
    /* a preview without asset URIs: nothing to prefetch */
  }
}

/**
 * The hub, the app's first screen: a top bar (logo; Sign in, or my initials opening Account), a
 * greeting in Dhaka time and six photo tiles. Esports and Gym zoom through into their sections
 * (remembered for the next cold start); Venues, Shop, Hire and Events open kriraghor.com in the
 * in-app browser. On a cold start with a remembered section the hub sends the person straight there.
 */
export default function Hub() {
  // Read once on the first mount; cleared after, so coming back here later stays on the hub.
  const [start] = useState(startSection);
  useEffect(() => setStartSection(null), []);
  if (start) return <Redirect href={SECTION_HOME[start]} />;
  return <HubScreen />;
}

function HubScreen() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { status } = useAuth();
  const me = useMe();
  const [leaving, setLeaving] = useState(false);
  // Enters from 1.06 (zooming out of a section); leaves to 1.08 (zooming into one).
  const { style, leave, onLayout } = useZoomScene(ZOOM.hubIn.from, ZOOM.hubIn.duration, ZOOM.hubOut.scale, ZOOM.hubOut.duration);
  useEffect(prefetchPhotos, []);

  const name = status === 'signed_in' ? firstName(me.data?.displayName) : '';
  const greeting = name ? t(`hub.greeting.${dayPart(new Date())}`, { name }) : t('hub.welcome');

  const open = (key: TileKey) => {
    const target = tileTarget(TILE_BY_KEY[key], config.webUrl);
    if ('external' in target) return void WebBrowser.openBrowserAsync(target.external).catch(() => undefined);
    if (leaving) return;
    setLeaving(true);
    leave(() => void openSection(target.section));
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Animated.View style={[{ flex: 1 }, style]} onLayout={onLayout} pointerEvents={leaving ? 'none' : 'auto'}>
        <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }]}>
          <View style={styles.bar}>
            <View style={styles.brand} accessible accessibilityRole="header" accessibilityLabel={t('hub.logo')}>
              <Image source={scheme === 'dark' ? LOGO.dark : LOGO.light} style={styles.logo} contentFit="contain" accessible={false} />
              <ThemedText style={styles.wordmark}>{t('hub.logo')}</ThemedText>
            </View>
            {status === 'signed_in' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('hub.account')}
                onPress={() => router.push('/account')}
                hitSlop={4}
                style={({ pressed }) => [styles.avatar, { backgroundColor: theme.brand }, pressed && { opacity: 0.85 }]}>
                {me.data ? (
                  <ThemedText type="smallBold" style={{ color: theme.onBrand, fontSize: 16 }}>
                    {initials(me.data.displayName)}
                  </ThemedText>
                ) : (
                  <Icon name="account" size={22} color={theme.onBrand} />
                )}
              </Pressable>
            ) : status === 'signed_out' ? (
              <AnimatedPressable accessibilityRole="button" onPress={() => router.push('/sign-in')} hitSlop={4} style={[styles.signIn, { backgroundColor: theme.brand }]}>
                <Icon name="sign-in" size={18} color={theme.onBrand} />
                <ThemedText type="smallBold" style={{ color: theme.onBrand }}>
                  {t('common.signIn')}
                </ThemedText>
              </AnimatedPressable>
            ) : null}
          </View>

          <Reveal style={styles.head}>
            <ThemedText style={styles.title} accessibilityRole="header">
              {greeting}
            </ThemedText>
            <ThemedText themeColor="textSecondary">{status === 'signed_out' ? t('hub.signInNote') : t('hub.sub')}</ThemedText>
          </Reveal>

          <View style={styles.grid}>
            {ROWS.map((row, r) => (
              <View key={row.keys.join('-')} style={[styles.row, { height: row.height }]}>
                {row.keys.map((key, c) => (
                  <HubTile key={key} tileKey={key} index={r * 2 + c + 1} big={key === 'esports'} onOpen={open} />
                ))}
              </View>
            ))}
          </View>

          <View style={styles.note}>
            <Icon name="info" size={18} color={theme.textSecondary} style={{ marginTop: 2 }} />
            <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
              {t('hub.webNote')}
            </ThemedText>
          </View>

          {config.appEnv !== 'production' ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.env}>
              {config.appEnv} · {config.apiUrl}
            </ThemedText>
          ) : null}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

/** One photo tile: springs to 0.97 while held; the release starts the zoom-through or opens the website. */
function HubTile({ tileKey, index, big, onOpen }: { tileKey: TileKey; index: number; big?: boolean; onOpen: (key: TileKey) => void }) {
  const { t } = useTranslation();
  const web = 'webPath' in TILE_BY_KEY[tileKey];
  return (
    <Reveal index={index} style={{ flex: 1 }}>
      <AnimatedPressable
        accessibilityRole={web ? 'link' : 'button'}
        accessibilityLabel={`${t(`hub.tiles.${tileKey}.title`)}. ${t(`hub.tiles.${tileKey}.body`)}`}
        accessibilityHint={web ? t('hub.opensWebsite') : undefined}
        onPress={() => onOpen(tileKey)}
        style={[tileStyle, { flex: 1 }]}>
        <TileFace photo={SECTION_PHOTOS[tileKey]} icon={ICONS[tileKey]} title={t(`hub.tiles.${tileKey}.title`)} body={t(`hub.tiles.${tileKey}.body`)} web={web} big={big} />
      </AnimatedPressable>
    </Reveal>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, gap: 16 },
  bar: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 36, height: 36 },
  wordmark: { fontSize: 20, lineHeight: 28, fontWeight: '800' },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  signIn: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, borderRadius: Radius.pill },
  head: { gap: 4, paddingHorizontal: 4 },
  title: { fontSize: 28, lineHeight: 36, fontWeight: '800' },
  grid: { gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  note: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  env: { textAlign: 'center' },
});
