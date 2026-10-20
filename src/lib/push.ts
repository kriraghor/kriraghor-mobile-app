import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { api } from './api';
import { registerForPush, type PushRegistration } from './notifications';
import { secureStore } from './secure-store';

/**
 * This phone's push registration with the API (M08 push channel, POST/DELETE /me/push-subscriptions).
 * - Turning notifications on (Account) asks for permission, then registers the token.
 * - After sign-in, a phone that already allowed notifications registers again without asking.
 * - Before sign-out the app removes the registration; the server also stops pushes to a signed-out
 *   sign-in on its own, so a failed removal is harmless.
 */
const KEY = 'kg.pushSubscriptionId';

async function register(reg: PushRegistration): Promise<PushRegistration> {
  if (reg.status !== 'granted') return reg;
  const { data, error } = await api.POST('/me/push-subscriptions', {
    body: { token: reg.token, platform: 'expo', ...(Device.modelName ? { deviceLabel: Device.modelName.slice(0, 80) } : {}) },
  });
  if (!error && data?.id) await secureStore.set(KEY, data.id);
  return reg;
}

/** The user tapped "Turn on notifications". */
export const enablePush = async () => register(await registerForPush());

/** After sign-in: register only if the phone already allows notifications (never prompts). */
export async function resumePush() {
  const { status } = await Notifications.getPermissionsAsync().catch(() => ({ status: 'undetermined' }));
  if (status === 'granted') await register(await registerForPush()).catch(() => undefined);
}

/** Before sign-out. */
export async function removePush() {
  const id = await secureStore.get(KEY).catch(() => null);
  if (!id) return;
  await api.DELETE('/me/push-subscriptions/{id}', { params: { path: { id } } }).catch(() => undefined);
  await secureStore.remove(KEY).catch(() => undefined);
}
