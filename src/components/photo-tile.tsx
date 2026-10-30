import { Icon, type IconName } from '@/components/icons/Icon';
import { Image } from 'expo-image';
import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/motion';

/**
 * A black gradient over a photo (30% at the top for the icon badge), weighted to the bottom where the
 * text sits: 85% black there, so white text stays above 4.5:1 on any photo.
 */
export function PhotoTint({ strength = 1 }: { strength?: number }) {
  const id = `tint-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none" pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity={0.3 * strength} />
          <Stop offset="0.45" stopColor="#000" stopOpacity={0.4 * strength} />
          <Stop offset="1" stopColor="#000" stopOpacity={Math.min(0.9, 0.85 * strength)} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="1" height="1" fill={`url(#${id})`} />
    </Svg>
  );
}

/** What a hub tile shows: the photo, the tint, an icon, the name and one short line (white). */
export function TileFace({ photo, icon, title, body, web, big }: { photo: number; icon: IconName; title: string; body: string; web?: boolean; big?: boolean }) {
  return (
    <>
      <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} accessible={false} />
      <PhotoTint />
      <View style={styles.top}>
        <View style={styles.iconChip}>
          <Icon name={icon} size={24} color="#FFFFFF" active />
        </View>
        {web ? <Icon name="external" size={18} color="#FFFFFF" /> : null}
      </View>
      <View style={styles.text}>
        <ThemedText style={[big ? styles.titleBig : styles.title, styles.white]}>{title}</ThemedText>
        <ThemedText type="small" style={[styles.white, styles.body]} numberOfLines={2}>
          {body}
        </ThemedText>
      </View>
    </>
  );
}

export const tileStyle: StyleProp<ViewStyle> = { borderRadius: Radius.card, overflow: 'hidden', justifyContent: 'space-between', padding: 16 };

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  iconChip: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,26,18,0.55)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.28)' },
  text: { gap: 2 },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '800' },
  titleBig: { fontSize: 28, lineHeight: 36, fontWeight: '800' },
  white: { color: '#FFFFFF' },
  body: { opacity: 0.92 },
});
