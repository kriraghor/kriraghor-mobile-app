import { Platform } from 'react-native';
import { sectionMemory, type KeyValueStore } from './section';
import { secureStore } from './secure-store';

/**
 * Where the last section is kept: the phone's secure store (like the language), and on the web build
 * (previews only) localStorage, since secure-store keeps nothing across a reload there. It is only
 * "esports" or "gym", nothing personal; any storage error means "no section" and the hub shows.
 */
const webStore: KeyValueStore = {
  get: async (key) => {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set: async (key, value) => {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      /* storage off: the hub shows next time */
    }
  },
  remove: async (key) => {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      /* nothing kept */
    }
  },
};

export const sections = sectionMemory(Platform.OS === 'web' ? webStore : secureStore);
