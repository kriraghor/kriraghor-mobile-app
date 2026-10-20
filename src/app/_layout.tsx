import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'react-native';
import { FONT_ASSETS, withTypeface } from '@/constants/fonts';
// Importing the i18n module also initialises it (English or Bangla from the phone).
import { restoreLanguage } from '@/i18n';
import { AuthProvider, useAuth } from '@/lib/auth';
import { queryClient } from '@/lib/query';

SplashScreen.preventAutoHideAsync();

function Navigator({ ready }: { ready: boolean }) {
  const { status } = useAuth();
  const { t, i18n } = useTranslation();
  const loading = status === 'loading' || !ready;
  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);
  if (loading) return null;
  return (
    <Stack screenOptions={{ headerTitleStyle: withTypeface({ fontWeight: '700' }, i18n.language) }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ title: t('common.signIn'), presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS);
  const [languageReady, setLanguageReady] = useState(false);
  useEffect(() => {
    void restoreLanguage().finally(() => setLanguageReady(true));
  }, []);
  // A font that fails to load falls back to the system font rather than blocking the app.
  const ready = languageReady && (fontsLoaded || Boolean(fontError));
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <Navigator ready={ready} />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
