import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'react-native';
import { AnimatedSplash } from '@/components/AnimatedSplash';
import { FONT_ASSETS, withTypeface } from '@/constants/fonts';
// Importing the i18n module also initialises it (English or Bangla from the phone).
import { restoreLanguage } from '@/i18n';
import { AuthProvider, useAuth } from '@/lib/auth';
import { queryClient } from '@/lib/query';
import { usePushTaps } from '@/lib/use-push-taps';
import { useRealtimeBridge } from '@/lib/use-realtime';

SplashScreen.preventAutoHideAsync();

function Navigator({ ready }: { ready: boolean }) {
  const { status } = useAuth();
  const loading = status === 'loading' || !ready;
  useRealtimeBridge();
  usePushTaps(!loading);
  // The animated splash takes over from the native one and hides it on its first frame.
  const [splash, setSplash] = useState(true);
  const splashDone = useCallback(() => setSplash(false), []);
  return (
    <>
      {loading ? null : <AppStack />}
      {splash ? <AnimatedSplash ready={!loading} onDone={splashDone} /> : null}
    </>
  );
}

function AppStack() {
  const { t, i18n } = useTranslation();
  return (
    <Stack screenOptions={{ headerTitleStyle: withTypeface({ fontWeight: '700' }, i18n.language) }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ title: t('common.signIn'), presentation: 'modal' }} />
      <Stack.Screen name="register/[id]" options={{ title: t('register.title') }} />
      <Stack.Screen name="pay/[paymentId]" options={{ title: t('pay.title'), gestureEnabled: false }} />
      <Stack.Screen name="room/[matchId]" options={{ title: t('room.title') }} />
      <Stack.Screen name="result/[matchId]" options={{ title: t('result.title') }} />
      <Stack.Screen name="game-ids" options={{ title: t('gameIds.title') }} />
      <Stack.Screen name="notifications" options={{ title: t('notifications.title') }} />
      <Stack.Screen name="squads" options={{ title: t('squads.title') }} />
      <Stack.Screen name="split/[registrationId]" options={{ title: t('split.title') }} />
      <Stack.Screen name="winnings" options={{ title: t('winnings.title') }} />
      <Stack.Screen name="payout-account" options={{ title: t('payout.title') }} />
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
