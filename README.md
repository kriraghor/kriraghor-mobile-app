# Kriraghor Mobile (App Store · Play Store)

| | |
|---|---|
| **Repo** | `kriraghor-mobile` |
| **Status** | B0 foundation (20 Oct 2026): five tabs (Home, Events, Matches, Ranks, Account), English and Bangla, TanStack Query, phone OTP sign-in (M01), secure token storage, push channels. Esports screens come next (B1) |
| **Stack** | Expo SDK 57, expo-router, TypeScript strict, React Native 0.86 (New Architecture, Hermes), openapi-fetch, TanStack Query, i18next, socket.io-client, jest-expo |
| **Decisions** | ADR-002 (shared OpenAPI contract), [ADR-004](../kriraghor-docs/decisions/ADR-004-cross-subdomain-auth.md) (mobile uses body tokens, not cookies) |
| **First features** | Esports (M21: register, room reveal by push, winnings, withdraw) and booking (M10) |

## Run locally

```bash
npm install
npx expo start              # press a for Android emulator, or scan with a development build
```

The backend runs on your machine (`npm run dev` and `npm run dev:realtime` in `../kriraghor-backend`). The Android emulator reaches it at `http://10.0.2.2:4000`. For a physical phone, set `API_URL=http://<your-LAN-IP>:4000/api/v1` before `npx expo start`.

`expo-secure-store` and `expo-notifications` include native code, so use a development build (`npx eas-cli@latest build --profile development`) rather than Expo Go.

| Script | What it does |
|---|---|
| `npm run lint` · `npm run typecheck` | `expo lint`, `tsc --noEmit` |
| `npm test` | jest-expo unit tests (session storage, refresh, retry; English and Bangla keys; the Bangla typeface) |
| `npm run api:sync` | Regenerate `src/lib/api/schema.d.ts` from `../kriraghor-backend/openapi.json` (`API_SPEC=<path or url>` for another branch) |
| `npx expo start --web` | A quick look in the browser at phone width (sessions are kept in memory there, so a reload signs out) |
| `npx expo export --platform android` | Bundle check without a device |

## Configuration

`app.config.ts` reads `APP_ENV`, `API_URL` and `REALTIME_URL`; `eas.json` sets them per build profile:

| Profile | APP_ENV | API | Bundle ID |
|---|---|---|---|
| `development` | development | `http://10.0.2.2:4000/api/v1` | `com.kriraghor.app.development` |
| `preview` | preview | `https://api.staging.kriraghor.com/api/v1` | `com.kriraghor.app.preview` |
| `production` | production | `https://api.kriraghor.com/api/v1` | `com.kriraghor.app` |

Run `npx eas-cli@latest init` once to create the EAS project and set `EAS_PROJECT_ID` (needed for push tokens).

## Sessions (ADR-004)
Every request sends `X-Client-Type: mobile`, so sign-in and refresh return the refresh token in the body (no cookies, no CSRF). The refresh token is stored with `expo-secure-store` (Keychain or Keystore, this device only, after first unlock); the access token stays in memory. Refresh is single-flight, and a 401 `TOKEN_EXPIRED` or `AUTHZ_STALE` refreshes once and retries.

## Languages
English and Bangla (`src/i18n`). The app follows the phone's language until the user picks one in Account; the choice is kept on the device. `bn.ts` is typed from `en.ts`, so a missing key fails the typecheck, and a test checks every Bangla text is translated. Bangla text uses Hind Siliguri (`src/constants/fonts.ts`). User-facing names follow kriraghor-docs 04 §0: Venues, Events, Showcases.

## Push
`src/lib/notifications.ts` creates the Android channels the backend sends on (`urgent`: room ready, check-in open, security; `default`: everything else), asks permission when the user turns notifications on (never at launch) and gets the Expo push token. Registering it with `POST /me/push-subscriptions` comes with the esports screens (B1); the backend side is on kriraghor-backend `feat/mobile-push-and-return`.
