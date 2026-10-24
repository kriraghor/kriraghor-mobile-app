import type { ConfigContext, ExpoConfig } from 'expo/config';

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
  updates: {
    url: 'https://u.expo.dev/f3014002-a260-4797-b25c-5a123d717b7b',
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  ios: {
    icon: './assets/images/icon.png',
    bundleIdentifier: `com.kriraghor.app${suffix}`,
    supportsTablet: false,
  },
  android: {
    package: `com.kriraghor.app${suffix}`,
    adaptiveIcon: {
      backgroundColor: '#F3F5F3',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: { output: 'static', favicon: './assets/images/favicon.png' },
  plugins: [
    'expo-router',
    ['expo-splash-screen', { backgroundColor: '#f3f5f3', image: './assets/brand/logo-mark.png', imageWidth: 96, dark: { backgroundColor: '#0c120f', image: './assets/brand/logo-mark.png' } }],
    'expo-secure-store',
    ['expo-notifications', { color: '#0B7A4B' }],
    'expo-localization',
    ['expo-image-picker', { photosPermission: 'Kriraghor uses your photos to upload a screenshot of your game profile.', cameraPermission: false, microphonePermission: false }],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: {
    appEnv: APP_ENV,
    apiUrl: process.env.API_URL ?? 'https://api.kriraghor.com/api/v1',
    realtimeUrl: process.env.REALTIME_URL ?? 'https://api.kriraghor.com',
    webUrl: process.env.WEB_URL ?? 'https://kriraghor.com',
    eas: { projectId: 'f3014002-a260-4797-b25c-5a123d717b7b' },
  },
});