import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SectionsButton } from '@/components/sections';
import { HEADER_TITLE } from '@/constants/fonts';
import { useTheme } from '@/hooks/use-theme';

/** Events tab: the list, then an event's page, inside the tab (the tab bar stays). */
export default function EventsLayout() {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerTitleStyle: HEADER_TITLE,
        headerShadowVisible: false,
      }}>
      <Stack.Screen name="index" options={{ title: t('events.title'), headerRight: () => <SectionsButton /> }} />
      <Stack.Screen name="[id]" options={{ title: '' }} />
    </Stack>
  );
}
