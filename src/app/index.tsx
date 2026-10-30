import { Icon, type IconName } from '@/components/icons/Icon';
import { Redirect, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion, withTiming, type EntryAnimationsValues } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TileFace, tileStyle, ZoomOverlay } from '@/components/photo-tile';
import { openSection } from '@/components/sections';
import { ThemedText } from '@/components/themed-text';
import { AnimatedPressable, Button, Reveal } from '@/components/ui';
import { Radius } from '@/constants/motion';
import { SECTION_PHOTOS } from '@/constants/section-photos';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { config } from '@/lib/config';
import type { Rect } from '@/lib/motion';
import { SECTION_HOME, setStartSection, startSection, tileTarget, TILES, type Tile, type TileKey } from '@/lib/section';
import { useMe } from '@/lib/use-me';

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

/** Coming back to the hub reads as zooming out: the page settles from slightly larger while it fades in. */
function zoomOutEntering(values: EntryAnimationsValues) {
  'worklet';
  void values;
  return {
    initialValues: { opacity: 0, transform: [{ scale: 1.06 }] },
    animations: { opacity: withTiming(1, { duration: 300 }), transform: [{ scale: withTiming(1, { duration: 300 }) }] },
  };
}

/**
 * The hub, the app's first screen: a greeting and six photo tiles. Esports and Gym zoom into their
 * sections (remembered for the next cold start); Venues, Shop, Hire and Events zoom, open
 * kriraghor.com in the in-app browser, and zoom back when it closes. On a cold start with a
 * remembered section the hub sends the person straight there.
 */
export default function Hub() {
  // Read once on the first mount; cleared after, so coming back here later stays on the hub.
  const [start] = useState(startSection);
  useEffect(() => setStartSection(null), []);
  if (start) return <Redirect href={SECTION_HOME[start]} />;
  return <HubScreen />;
}

type Zoom = { key: TileKey; rect: Rect; out: boolean };

function HubScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const { t } = useTranslation();
  const { status } = useAuth();
  const me = useMe();
  const name = status === 'signed_in' ? me.data?.displayName : undefined;
  const [zoom, setZoom] = useState<Zoom | null>(null);

  const open = (key: TileKey, rect: Rect) => {
    if (zoom) return;
    setZoom({ key, rect, out: false });
  };
  // Zoomed in: go into the section (the stack crossfades it in over the full-screen photo), or open
  // the website and zoom back out once the browser closes.
  const zoomedIn = useCallback(() => {
    if (!zoom) return;
    const target = tileTarget(TILE_BY_KEY[zoom.key], config.webUrl);
    if ('external' in target) {
      void WebBrowser.openBrowserAsync(target.external)
        .catch(() => undefined)
        .finally(() => setZoom((z) => (z ? { ...z, out: true } : z)));
    } else void openSection(target.section);
  }, [zoom]);
  const zoomedOut = useCallback(() => setZoom(null), []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Animated.View entering={reduce || Platform.OS === 'web' ? undefined : zoomOutEntering} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}>
          <Reveal style={styles.head}>
            <ThemedText style={styles.title} accessibilityRole="header">
              {name ? t('hub.hello', { name }) : t('hub.welcome')}
            </ThemedText>
            <ThemedText themeColor="textSecondary">{t('hub.sub')}</ThemedText>
          </Reveal>

          {status === 'signed_out' ? (
            <Reveal index={1} style={[styles.signIn, { backgroundColor: theme.backgroundElement, borderColor: theme.line }]}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('hub.signInNote')}
              </ThemedText>
              <Button title={t('common.signIn')} onPress={() => router.push('/sign-in')} />
            </Reveal>
          ) : null}

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

      {zoom ? (
        <ZoomOverlay rect={zoom.rect} out={zoom.out} onIn={zoomedIn} onOut={zoomedOut}>
          <TileFace photo={SECTION_PHOTOS[zoom.key]} icon={ICONS[zoom.key]} title={t(`hub.tiles.${zoom.key}.title`)} body={t(`hub.tiles.${zoom.key}.body`)} big />
        </ZoomOverlay>
      ) : null}
    </View>
  );
}

/** One photo tile: measured on press so the zoom starts exactly where it sits. */
function HubTile({ tileKey, index, big, onOpen }: { tileKey: TileKey; index: number; big?: boolean; onOpen: (key: TileKey, rect: Rect) => void }) {
  const { t } = useTranslation();
  const ref = useRef<View>(null);
  const web = 'webPath' in TILE_BY_KEY[tileKey];
  const press = () => {
    const node = ref.current;
    if (!node) return onOpen(tileKey, { x: 0, y: 0, width: 0, height: 0 });
    node.measureInWindow((x, y, width, height) => onOpen(tileKey, { x, y, width, height }));
  };
  return (
    <Reveal index={index} style={{ flex: 1 }}>
      <View ref={ref} collapsable={false} style={{ flex: 1 }}>
        <AnimatedPressable
          accessibilityRole={web ? 'link' : 'button'}
          accessibilityLabel={`${t(`hub.tiles.${tileKey}.title`)}. ${t(`hub.tiles.${tileKey}.body`)}`}
          accessibilityHint={web ? t('hub.opensWebsite') : undefined}
          onPress={press}
          style={[tileStyle, { flex: 1 }]}>
          <TileFace photo={SECTION_PHOTOS[tileKey]} icon={ICONS[tileKey]} title={t(`hub.tiles.${tileKey}.title`)} body={t(`hub.tiles.${tileKey}.body`)} web={web} big={big} />
        </AnimatedPressable>
      </View>
    </Reveal>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, gap: 16 },
  head: { gap: 4, paddingHorizontal: 4 },
  title: { fontSize: 28, lineHeight: 36, fontWeight: '800' },
  signIn: { gap: 12, padding: 16, borderWidth: 1, borderRadius: Radius.card },
  grid: { gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  note: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  env: { textAlign: 'center' },
});
