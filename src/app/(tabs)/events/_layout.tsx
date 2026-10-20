import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { withTypeface } from '@/constants/fonts';
import { useTheme } from '@/hooks/use-theme';

/** Events tab: the list, then an event's page, inside the tab (the tab bar stays). */
export default function EventsLayout() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerTitleStyle: withTypeface({ fontWeight: '700' }, i18n.language),
      }}>
      <Stack.Screen name="index" options={{ title: t('events.title') }} />
      <Stack.Screen name="[id]" options={{ title: '' }} />
    </Stack>
  );
}
