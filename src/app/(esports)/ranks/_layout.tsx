import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SectionsButton } from '@/components/sections';
import { withTypeface } from '@/constants/fonts';
import { useTheme } from '@/hooks/use-theme';

/** Ranks tab: the leaderboards, then a player's page, inside the tab (the tab bar stays). */
export default function RanksLayout() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerTitleStyle: withTypeface({ fontWeight: '700' }, i18n.language),
      }}>
      <Stack.Screen name="index" options={{ title: t('ranks.title'), headerRight: () => <SectionsButton /> }} />
      <Stack.Screen name="[handle]" options={{ title: '' }} />
    </Stack>
  );
}
