import type { ConfigContext } from 'expo/config';

import eas from '../../../eas.json';

type Extra = { appEnv: string; apiUrl: string; realtimeUrl: string; webUrl: string; gymUrl: string };

const URL_VARS = ['API_URL', 'REALTIME_URL', 'WEB_URL', 'GYM_URL'] as const;
const EXTRA_KEY = { API_URL: 'apiUrl', REALTIME_URL: 'realtimeUrl', WEB_URL: 'webUrl', GYM_URL: 'gymUrl' } as const;

/** app.config.ts as a process with this environment evaluates it (APP_ENV is read when the file loads). */
function extraFor(env: Record<string, string>): Extra {
  const names = ['APP_ENV', ...URL_VARS];
  const saved = names.map((name) => [name, process.env[name]] as const);
  for (const name of names) delete process.env[name];
  Object.assign(process.env, env);
  try {
    let extra: Extra | undefined;
    // A fresh copy each time: app.config.ts reads APP_ENV when it loads, so a plain import would
    // keep the first environment. (jest's babel preset does not transform a dynamic import().)
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const load = (require('../../../app.config') as typeof import('../../../app.config')).default;
      extra = load({ config: {} } as ConfigContext).extra as Extra;
    });
    return extra!;
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

const host = (url: string) => new URL(url).host;

describe('app config per build profile', () => {
  // CI publishes over-the-air updates with only APP_ENV set (.github/workflows/ci.yml), and an app
  // running an update reads `extra` from that update. So the defaults in app.config.ts must match
  // what the build profiles bake in, or an update silently moves the app to another address.
  it.each(['preview', 'production'] as const)('an over-the-air update to %s carries the same addresses as its build', (profile) => {
    const published = extraFor({ APP_ENV: profile });
    const built = extraFor(eas.build[profile].env);
    expect(published).toEqual(built);
    for (const name of URL_VARS) expect(published[EXTRA_KEY[name]]).toBe(eas.build[profile].env[name]);
  });

  it.each(['preview', 'production'] as const)('%s reaches Socket.IO on the realtime service, not on the API', (profile) => {
    const { apiUrl, realtimeUrl } = extraFor({ APP_ENV: profile });
    expect(realtimeUrl).toBe('https://kriraghor-realtime.onrender.com');
    // The API process does not serve /socket.io (it answers 404), so the two hosts must differ.
    expect(host(realtimeUrl)).not.toBe(host(apiUrl));
  });

  it('the development profile stays on the local backend', () => {
    expect(extraFor(eas.build.development.env)).toMatchObject({
      appEnv: 'development',
      apiUrl: 'http://10.0.2.2:4000/api/v1',
      realtimeUrl: 'http://10.0.2.2:4001',
      webUrl: 'http://10.0.2.2:3000',
      gymUrl: 'http://10.0.2.2:3003',
    });
  });
});
