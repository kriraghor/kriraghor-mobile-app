import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { EmptyState } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { goToHub } from '@/lib/section-nav';

/**
 * A link that leads nowhere (an old notification, a mistyped address): say so in our own words and
 * offer the way back, instead of the framework's bare "Unmatched route" page (UI v2).
 */
export default function NotFound() {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack.Screen options={{ title: t('notFound.header') }} />
      <EmptyState icon="search" title={t('notFound.title')} text={t('notFound.body')} action={{ title: t('hub.allSections'), onPress: () => void goToHub() }} />
    </View>
  );
}
