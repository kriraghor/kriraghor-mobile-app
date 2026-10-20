import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Push (M08 push channel). The backend sends on two Android channels: `urgent` (room ready,
 * check-in open, security; high importance, through quiet hours) and `default` (everything else).
 * Registering the token with the API (POST /me/push-subscriptions) comes with the esports screens.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const ANDROID_CHANNELS = {
  urgent: { name: 'Match alerts', description: 'Room ready, check-in open and account security', importance: 'HIGH' },
  default: { name: 'Updates', description: 'Payments, results, bookings and everything else', importance: 'DEFAULT' },
} as const;

async function createChannels() {
  if (Platform.OS !== 'android') return;
  for (const [id, c] of Object.entries(ANDROID_CHANNELS)) {
    await Notifications.setNotificationChannelAsync(id, {
      name: c.name,
      description: c.description,
      importance: Notifications.AndroidImportance[c.importance],
      lightColor: '#0B7A4B',
    });
  }
}

export type PushRegistration = { status: 'granted'; token: string } | { status: 'denied' | 'unavailable'; reason: 'denied' | 'not_device' | 'no_project' };

/** Ask for permission (only when the user turns notifications on, never at launch) and get the token. */
export async function registerForPush(): Promise<PushRegistration> {
  if (!Device.isDevice) return { status: 'unavailable', reason: 'not_device' };
  // Android 13+: the permission prompt only appears once a channel exists.
  await createChannels();

  const existing = await Notifications.getPermissionsAsync();
  const status = existing.status === 'granted' ? existing.status : (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return { status: 'denied', reason: 'denied' };

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return { status: 'unavailable', reason: 'no_project' };
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return { status: 'granted', token: token.data };
}
