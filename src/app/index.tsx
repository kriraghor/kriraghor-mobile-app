import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Redirect, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openSection } from '@/components/sections';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { config } from '@/lib/config';
import { SECTION_HOME, setStartSection, startSection, tileTarget, TILES, type Tile, type TileKey } from '@/lib/section';
import { useMe } from '@/lib/use-me';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
const ICONS: Record<TileKey, IconName> = {
  esports: 'gamepad-variant',
  gym: 'dumbbell',
  venues: 'soccer-field',
  shop: 'storefront-outline',
  hire: 'account-tie',
  events: 'trophy-outline',
};

/**
 * The hub, the app's first screen: a greeting and six tiles. Esports and Gym open their sections
 * (remembered for the next cold start); Venues, Shop, Hire and Events open kriraghor.com in the in-app
 * browser. On a cold start with a remembered section the hub sends the person straight there.
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
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { status } = useAuth();
  const me = useMe();
  const name = status === 'signed_in' ? me.data?.displayName : undefined;
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={[styles.page, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}>
      <View style={styles.head}>
        <ThemedText style={styles.title} accessibilityRole="header">
          {name ? t('hub.hello', { name }) : t('hub.welcome')}
        </ThemedText>
        <ThemedText themeColor="textSecondary">{t('hub.sub')}</ThemedText>
      </View>

      {status === 'signed_out' ? (
        <View style={styles.signIn}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('hub.signInNote')}
          </ThemedText>
          <Button title={t('common.signIn')} onPress={() => router.push('/sign-in')} />
        </View>
      ) : null}

      <View style={styles.grid}>
        {TILES.map((tile) => (
          <TileCard key={tile.key} tile={tile} />
        ))}
      </View>

      <View style={styles.note}>
        <MaterialCommunityIcons name="information-outline" size={18} color={theme.textSecondary} style={{ marginTop: 2 }} />
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
  );
}

/** One tile: icon, name and a short line; web tiles carry an open-in-new mark and say they open the website. */
function TileCard({ tile }: { tile: Tile }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const target = tileTarget(tile, config.webUrl);
  const web = 'external' in target;
  const open = () => {
    if ('external' in target) void WebBrowser.openBrowserAsync(target.external);
    else void openSection(target.section);
  };
  return (
    <Pressable
      accessibilityRole={web ? 'link' : 'button'}
      accessibilityHint={web ? t('hub.opensWebsite') : undefined}
      onPress={open}
      style={({ pressed }) => [styles.tile, { backgroundColor: theme.backgroundElement, borderColor: web ? theme.line : theme.brand }, pressed && { opacity: 0.85 }]}>
      <View style={styles.tileTop}>
        <View style={[styles.icon, { backgroundColor: web ? theme.backgroundSelected : theme.brand }]}>
          <MaterialCommunityIcons name={ICONS[tile.key]} size={26} color={web ? theme.text : theme.onBrand} />
        </View>
        {web ? <MaterialCommunityIcons name="open-in-new" size={18} color={theme.textSecondary} /> : null}
      </View>
      <ThemedText style={styles.tileTitle}>{t(`hub.tiles.${tile.key}.title`)}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t(`hub.tiles.${tile.key}.body`)}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, gap: 20 },
  head: { gap: 6, paddingHorizontal: 4 },
  title: { fontSize: 28, lineHeight: 36, fontWeight: '800' },
  signIn: { gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { flexBasis: '47%', flexGrow: 1, minHeight: 148, borderWidth: 1.5, padding: 14, gap: 6 },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  icon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontSize: 18, lineHeight: 26, fontWeight: '700' },
  note: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  env: { textAlign: 'center' },
});
