import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Small values kept on the device: the refresh token (ADR-004) and the chosen language. On phones
 * this is the Keychain or Keystore. The web build (`expo start --web`, used only for previews) has
 * no secure storage, so values live in memory there and a reload signs out; never in localStorage.
 */
const memory = new Map<string, string>();
const web = Platform.OS === 'web';

export const secureStore = {
  get: (key: string): Promise<string | null> => (web ? Promise.resolve(memory.get(key) ?? null) : SecureStore.getItemAsync(key)),
  set: async (key: string, value: string) => {
    if (web) memory.set(key, value);
    else await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
  },
  remove: async (key: string) => {
    if (web) memory.delete(key);
    else await SecureStore.deleteItemAsync(key);
  },
};
