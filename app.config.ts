import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * App config per EAS build profile (eas.json sets APP_ENV, API_URL and REALTIME_URL for each).
 * Values reach the app through `extra` (src/lib/config.ts). Nothing secret goes here: the app
 * bundle is public.
 */
const APP_ENV = process.env.APP_ENV ?? 'development';
const isProd = APP_ENV === 'production';
const suffix = isProd ? '' : `.${APP_ENV}`;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: isProd ? 'Kriraghor' : `Kriraghor (${APP_ENV})`,
  slug: 'kriraghor',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'kriraghor',
  userInterfaceStyle: 'automatic',
  ios: {
    icon: './assets/expo.icon',
    bundleIdentifier: `com.kriraghor.app${suffix}`,
    supportsTablet: false,
  },
  android: {
    package: `com.kriraghor.app${suffix}`,
    adaptiveIcon: {
      backgroundColor: '#0B7A4B',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: { output: 'static', favicon: './assets/images/favicon.png' },
  plugins: [
    'expo-router',
    ['expo-splash-screen', { backgroundColor: '#0A1A12', image: './assets/images/splash-icon.png', imageWidth: 76 }],
    'expo-secure-store',
    ['expo-notifications', { color: '#0B7A4B' }],
    'expo-localization',
    // Game ID screenshots (M21-FR-02): photo library only, no camera.
    ['expo-image-picker', { photosPermission: 'Kriraghor uses your photos to upload a screenshot of your game profile.', cameraPermission: false, microphonePermission: false }],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: {
    appEnv: APP_ENV,
    // Android emulators reach the host machine at 10.0.2.2; physical devices need the LAN IP.
    apiUrl: process.env.API_URL ?? 'http://10.0.2.2:4000/api/v1',
    realtimeUrl: process.env.REALTIME_URL ?? 'http://10.0.2.2:4001',
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
});
