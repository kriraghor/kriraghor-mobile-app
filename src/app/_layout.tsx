import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'react-native';
import { AnimatedSplash } from '@/components/AnimatedSplash';
import { FONT_ASSETS, withTypeface } from '@/constants/fonts';
// Importing the i18n module also initialises it (English or Bangla from the phone).
import { restoreLanguage } from '@/i18n';
import { useAutoUpdates } from '@/lib/app-updates';
import { AuthProvider, useAuth } from '@/lib/auth';
import { queryClient } from '@/lib/query';
import { HUB, setStartSection } from '@/lib/section';
import { sections } from '@/lib/section-store';
import { usePushTaps } from '@/lib/use-push-taps';
import { useRealtimeBridge } from '@/lib/use-realtime';

SplashScreen.preventAutoHideAsync();

function Navigator({ ready }: { ready: boolean }) {
  const { status } = useAuth();
  // The last section (esports or gym) is read while the splash shows; the hub opens it on a cold start.
  const [sectionRead, setSectionRead] = useState(false);
  useEffect(() => {
    void sections
      .load()
      .then(setStartSection)
      .finally(() => setSectionRead(true));
  }, []);
  const loading = status === 'loading' || !ready || !sectionRead;
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
  // A launch that opened another screen (a link or a notification) never jumps to the remembered section.
  const pathname = usePathname();
  // The hub and the sections animate themselves (components/transition.tsx), so the stack does not.
  const scene = 'none';
  useEffect(() => {
    if (pathname !== HUB) setStartSection(null);
  }, [pathname]);
  return (
    <Stack screenOptions={{ headerTitleStyle: withTypeface({ fontWeight: '700' }, i18n.language) }}>
      {/* The hub, then the two in-app sections (each its own tabs). */}
      <Stack.Screen name="index" options={{ headerShown: false, title: t('common.appName'), animation: scene }} />
      <Stack.Screen name="(esports)" options={{ headerShown: false, title: t('hub.tiles.esports.title'), animation: scene }} />
      <Stack.Screen name="(gym)" options={{ headerShown: false, title: t('hub.tiles.gym.title'), animation: scene }} />
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
      {/* Gym detail screens (M24 §4.5, members only), pushed over the Gym tabs. */}
      <Stack.Screen name="gym/requests" options={{ title: t('gymRequests.title') }} />
      <Stack.Screen name="gym/[memberId]/index" options={{ title: t('gymMember.title') }} />
      <Stack.Screen name="gym/[memberId]/attendance" options={{ title: t('gymAttendance.title') }} />
      <Stack.Screen name="gym/plans/[assignmentId]" options={{ title: t('gymPlan.title') }} />
      <Stack.Screen name="gym/subscriptions" options={{ title: t('gymSubs.title') }} />
      {/* The public gym directory and gym pages (M20 §4): open to guests. */}
      <Stack.Screen name="gyms/index" options={{ title: t('gymDir.tab') }} />
      <Stack.Screen name="gyms/[slug]" options={{ title: '' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS);
  const [languageReady, setLanguageReady] = useState(false);

  useAutoUpdates();

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
