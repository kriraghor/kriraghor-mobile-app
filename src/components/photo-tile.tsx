import { Icon, type IconName } from '@/components/icons/Icon';
import { Image } from 'expo-image';
import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { ThemedText } from '@/components/themed-text';
import { displayFace } from '@/constants/fonts';
import { Radius } from '@/constants/motion';
import { useTheme } from '@/hooks/use-theme';

/**
 * A black tint over the whole photo: darker at the top (where the icon badge sits) and darkest at the
 * bottom (where the text sits), so white text stays above 4.5:1 on any photo, light ones included.
 *
 * The gradient lives in its own full-size layer. Sized in percent directly inside a padded tile it stopped
 * short of the right and bottom edges (a percent size is measured against the tile's content box, which
 * leaves the padding out): the layer has no padding, so the tint reaches every edge.
 */
export function PhotoTint({ strength = 1 }: { strength?: number }) {
  const id = `tint-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000" stopOpacity={Math.min(0.9, 0.5 * strength)} />
            <Stop offset="0.42" stopColor="#000" stopOpacity={Math.min(0.9, 0.34 * strength)} />
            <Stop offset="1" stopColor="#000" stopOpacity={Math.min(0.92, 0.88 * strength)} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="1" height="1" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/**
 * What a hub tile shows: the photo, the tint over all of it, an icon, the name in the heading face and one
 * short line (white). `live` is a small orange chip with something true right now ("3 open now"). A tile
 * that opens a section of the app ends in an orange arrow; one that opens the website shows the "opens
 * outside" mark instead. `compact` is the small form for the website sections: the name only.
 */
export function TileFace({ photo, icon, title, body, web, big, live, compact }: { photo: number; icon: IconName; title: string; body?: string; web?: boolean; big?: boolean; live?: string | null; compact?: boolean }) {
  const theme = useTheme();
  return (
    <>
      <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} accessible={false} />
      <PhotoTint strength={compact ? 1.15 : 1} />
      <View style={styles.top}>
        <View style={[styles.iconChip, compact && styles.iconChipSmall]}>
          <Icon name={icon} size={compact ? 20 : 24} color="#FFFFFF" active />
        </View>
        {live ? (
          <View style={[styles.live, { backgroundColor: theme.accent }]}>
            <ThemedText style={[styles.liveText, { color: theme.onAccent }]} numberOfLines={1}>
              {live}
            </ThemedText>
          </View>
        ) : web ? (
          <Icon name="external" size={compact ? 16 : 18} color="#FFFFFF" />
        ) : null}
      </View>
      <View style={styles.bottom}>
        <View style={styles.text}>
          <ThemedText style={[compact ? styles.titleSmall : big ? styles.titleBig : styles.title, styles.white]} numberOfLines={compact ? 1 : 2}>
            {title}
          </ThemedText>
          {body && !compact ? (
            <ThemedText type="small" style={[styles.white, styles.body]} numberOfLines={2}>
              {body}
            </ThemedText>
          ) : null}
        </View>
        {!web && !compact ? (
          <View style={[styles.go, { backgroundColor: theme.accent }]}>
            <Icon name="arrow-right" size={20} color={theme.onAccent} />
          </View>
        ) : null}
      </View>
    </>
  );
}

export const tileStyle: StyleProp<ViewStyle> = { borderRadius: Radius.card, overflow: 'hidden', justifyContent: 'space-between', padding: 16 };
/** The small tile of a website section. */
export const compactTileStyle: StyleProp<ViewStyle> = { borderRadius: Radius.card, overflow: 'hidden', justifyContent: 'space-between', padding: 12 };

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  iconChip: { width: 44, height: 44, borderRadius: Radius.control, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,26,18,0.55)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.28)' },
  iconChipSmall: { width: 36, height: 36, borderRadius: Radius.control },
  live: { minHeight: 28, maxWidth: '70%', paddingHorizontal: 10, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  liveText: { fontSize: 12, lineHeight: 16, fontWeight: '800' },
  bottom: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  text: { flex: 1, gap: 2 },
  go: { width: 44, height: 44, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  title: { ...displayFace, fontSize: 24, lineHeight: 30 },
  titleBig: { ...displayFace, fontSize: 34, lineHeight: 40 },
  titleSmall: { ...displayFace, fontSize: 18, lineHeight: 24 },
  white: { color: '#FFFFFF' },
  body: { opacity: 0.92 },
});
