import Constants from 'expo-constants';

type Extra = { appEnv?: string; apiUrl?: string; realtimeUrl?: string; webUrl?: string; gymUrl?: string };

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/** Build-profile config from app.config.ts (set per EAS profile in eas.json). */
export const config = {
  appEnv: extra.appEnv ?? 'development',
  apiUrl: extra.apiUrl ?? 'http://10.0.2.2:4000/api/v1',
  realtimeUrl: extra.realtimeUrl ?? 'http://10.0.2.2:4001',
  webUrl: (extra.webUrl ?? 'http://10.0.2.2:3000').replace(/\/+$/, ''),
  /** The gym app (gym.kriraghor.com): pages the app has no screen for (owner panel, directory, pay links, receipts) open there. */
  gymUrl: (extra.gymUrl ?? 'http://10.0.2.2:3003').replace(/\/+$/, ''),
};
