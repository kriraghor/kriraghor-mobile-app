import { Icon } from '@/components/icons/Icon';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/motion';
import { useTheme } from '@/hooks/use-theme';
import { useLeaveToHub } from '@/components/transition';

export { goToHub, openSection } from '@/lib/section-nav';

/** "All sections": a header button (icon, 48px, labelled) on every section screen with a header. */
export function SectionsButton() {
  const theme = useTheme();
  const { t } = useTranslation();
  const leave = useLeaveToHub();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('hub.allSections')}
      onPress={leave}
      hitSlop={4}
      style={({ pressed }) => [styles.icon, pressed && { opacity: 0.7 }]}>
      <Icon name="sections" size={24} color={theme.text} />
    </Pressable>
  );
}

/** "All sections" as the first item of a screen without a header (Esports Home). */
export function SectionsChip() {
  const theme = useTheme();
  const { t } = useTranslation();
  const leave = useLeaveToHub();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={leave}
      style={({ pressed }) => [styles.chip, { borderColor: theme.line, backgroundColor: theme.backgroundElement }, pressed && { opacity: 0.85 }]}>
      <Icon name="sections" size={20} color={theme.text} />
      <ThemedText type="smallBold">{t('hub.allSections')}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  icon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  chip: { minHeight: 48, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderWidth: 1, borderRadius: Radius.control },
});
