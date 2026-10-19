import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Push notifications are set up but not sent yet: M08 (phase 1) adds the device-token endpoint
 * and Expo push delivery. Until then the token is only shown on the account screen.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type PushRegistration = { status: 'granted'; token: string } | { status: 'denied' | 'unavailable'; reason: string };

export async function registerForPush(): Promise<PushRegistration> {
  if (!Device.isDevice) return { status: 'unavailable', reason: 'Push needs a physical device' };

  // Android 13+: the permission prompt only appears once a channel exists.
  if (Platform.OS === 'android') {
    // The channel id stays 'tournaments' so phones that already have it keep it; only the name changes.
    await Notifications.setNotificationChannelAsync('tournaments', {
      name: 'Events',
      description: 'Room IDs, match starts and results',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#0B7A4B',
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  const status = existing.status === 'granted' ? existing.status : (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return { status: 'denied', reason: 'Notifications are turned off' };

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return { status: 'unavailable', reason: 'EAS project ID not configured yet (eas init)' };
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return { status: 'granted', token: token.data };
}
