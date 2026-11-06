import type { ConfigContext, ExpoConfig } from 'expo/config';

const APP_ENV = process.env.APP_ENV ?? 'development';
const isProd = APP_ENV === 'production';
const suffix = isProd ? '' : `.${APP_ENV}`;
const CAMERA_TEXT = "Kriraghor uses the camera to scan the gym's entrance QR code.";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: isProd ? 'Kriraghor' : `Kriraghor (${APP_ENV})`,
  slug: 'kriraghor',
  // 0.2.0: the gym screens add native modules (camera, brightness, keep-awake, SVG). runtimeVersion
  // follows the app version, so 0.1.0 builds never receive OTA JS that calls modules they lack.
  version: '0.2.0',
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
    // expo-brightness asks for WRITE_SETTINGS for the system brightness; the app only sets its own
    // window's brightness (setBrightnessAsync), which needs no permission.
    blockedPermissions: ['android.permission.WRITE_SETTINGS'],
  },
  web: { output: 'static', favicon: './assets/images/favicon.png' },
  plugins: [
    'expo-router',
    ['expo-splash-screen', { backgroundColor: '#f3f5f3', image: './assets/brand/logo-mark.png', imageWidth: 96, dark: { backgroundColor: '#0c120f', image: './assets/brand/logo-mark-dark.png' } }],
    'expo-secure-store',
    ['expo-notifications', { color: '#0B7A4B' }],
    'expo-localization',
    // The picker only reads photos. Its cameraPermission must not be false: that would block Android's
    // CAMERA permission for expo-camera too, so it carries the same camera text.
    ['expo-image-picker', { photosPermission: 'Kriraghor uses your photos to upload a screenshot of your game profile.', cameraPermission: CAMERA_TEXT, microphonePermission: false }],
    // The gym entrance QR scanner (M24 §4.5): camera only, no microphone.
    ['expo-camera', { cameraPermission: CAMERA_TEXT, microphonePermission: false, recordAudioAndroid: false }],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: {
    appEnv: APP_ENV,
    apiUrl: process.env.API_URL ?? 'https://api.kriraghor.com/api/v1',
    realtimeUrl: process.env.REALTIME_URL ?? 'https://api.kriraghor.com',
    webUrl: process.env.WEB_URL ?? 'https://kriraghor.com',
    gymUrl: process.env.GYM_URL ?? 'https://gym.kriraghor.com',
    eas: { projectId: 'f3014002-a260-4797-b25c-5a123d717b7b' },
  },
});