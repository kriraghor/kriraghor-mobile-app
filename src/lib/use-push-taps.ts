import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { linkToRoute } from './links';

/**
 * A tapped push opens the screen its link points to (room, result, my matches, an event), also when
 * the tap started the app. The push data carries only notificationId, code and link (M08).
 */
export function usePushTaps(ready: boolean) {
  useEffect(() => {
    if (!ready || Platform.OS === 'web') return;
    const open = (r: Notifications.NotificationResponse | null) => {
      const link = r?.notification.request.content.data?.link;
      if (typeof link !== 'string' && link !== null) return;
      const to = linkToRoute(link as string | null);
      // Gym links have no screen in the app yet: they open on gym.kriraghor.com in the browser.
      if (typeof to === 'string') router.push(to as never);
      else void WebBrowser.openBrowserAsync(to.external);
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      open(last);
      Notifications.clearLastNotificationResponse();
    }
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [ready]);
}
