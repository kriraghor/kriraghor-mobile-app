import { Icon } from '@/components/icons/Icon';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { HUB, SECTION_HOME, type Section } from '@/lib/section';
import { sections } from '@/lib/section-store';

/** Leave the section for the hub, forgetting it, so the next cold start shows the hub too. */
export async function goToHub() {
  await sections.forget();
  router.replace(HUB);
}

/** Open a section from the hub and remember it for the next cold start. */
export async function openSection(section: Section) {
  await sections.remember(section);
  router.replace(SECTION_HOME[section]);
}

/** "All sections": a header button (icon, 48px, labelled) on every section screen with a header. */
export function SectionsButton() {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('hub.allSections')}
      onPress={() => void goToHub()}
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
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => void goToHub()}
      style={({ pressed }) => [styles.chip, { borderColor: theme.line, backgroundColor: theme.backgroundElement }, pressed && { opacity: 0.85 }]}>
      <Icon name="sections" size={20} color={theme.text} />
      <ThemedText type="smallBold">{t('hub.allSections')}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  icon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  chip: { minHeight: 48, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderWidth: 1.5 },
});
