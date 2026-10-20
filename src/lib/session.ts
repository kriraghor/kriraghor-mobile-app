import { config } from './config';
import { secureStore } from './secure-store';

/**
 * Mobile session (ADR-004): no cookies. Every request sends `X-Client-Type: mobile`, so the API
 * returns the refresh token in the body. The refresh token lives in the device keychain/keystore
 * (expo-secure-store); the access token lives only in memory.
 */
export const CLIENT_HEADERS = { 'X-Client-Type': 'mobile' } as const;
const REFRESH_KEY = 'kg.refreshToken';

let accessToken: string | null = null;
let inflight: Promise<string | null> | null = null;

export const getAccessToken = () => accessToken;

/** Store the tokens from a signed-in or refresh response. */
export async function saveSession(tokens: { accessToken: string; refreshToken?: string }) {
  accessToken = tokens.accessToken;
  if (tokens.refreshToken) {
    await secureStore.set(REFRESH_KEY, tokens.refreshToken);
  }
}

export async function clearSession() {
  accessToken = null;
  await secureStore.remove(REFRESH_KEY);
}

export const hasStoredSession = async () => Boolean(await secureStore.get(REFRESH_KEY));

/**
 * Rotate the refresh token. Concurrent callers share one request: a second rotation with the same
 * token would look like theft to the API and revoke the whole session family.
 */
export function refresh(fetchImpl: typeof fetch = fetch): Promise<string | null> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const refreshToken = await secureStore.get(REFRESH_KEY);
      if (!refreshToken) return null;
      const res = await fetchImpl(`${config.apiUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...CLIENT_HEADERS },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        // Only a definite rejection ends the session; network errors keep the stored token.
        if (res.status === 401 || res.status === 403) await clearSession();
        return null;
      }
      const body = (await res.json()) as { accessToken: string; refreshToken: string };
      await saveSession(body);
      return body.accessToken;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

const REFRESHABLE = new Set(['TOKEN_EXPIRED', 'AUTHZ_STALE']);

/** fetch with the mobile header and bearer token; refreshes once on TOKEN_EXPIRED or AUTHZ_STALE. */
export function createAuthFetch(fetchImpl: typeof fetch = fetch) {
  return async function authFetch(input: Request): Promise<Response> {
    const send = (token: string | null) => {
      const req = input.clone();
      req.headers.set('X-Client-Type', 'mobile');
      if (token) req.headers.set('Authorization', `Bearer ${token}`);
      return fetchImpl(req);
    };
    const first = await send(accessToken);
    if (first.status !== 401) return first;
    const code = await first
      .clone()
      .json()
      .then((b: { code?: string }) => b.code)
      .catch(() => undefined);
    if (!code || !REFRESHABLE.has(code)) return first;
    const token = await refresh(fetchImpl);
    return token ? send(token) : first;
  };
}
