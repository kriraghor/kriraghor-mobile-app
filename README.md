# Kriraghor Mobile (App Store · Play Store)

| | |
|---|---|
| **Repo** | `kriraghor-mobile` |
| **Status** | App **0.2.0** (29 Oct 2026): esports (M21) and the member gym screens (M24 prompt 3b, mobile half). Five tabs (Home, Events, Matches, Ranks, Account), English and Bangla, phone OTP sign-in (M01), secure token storage, push that opens the right screen. 0.2.0 adds native modules (camera, brightness, keep-awake, SVG), so it needs a new build; 0.1.0 installs get no OTA updates with the gym screens. **10 Nov 2026 (over the air, no new build):** my classes, free trial visits, my points and my body, "How to do it" on library exercises, a gym page's class timetable, and My work (clock in and out, payslips) for gym staff (M27, M24 §17) |
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
| `npm test` | jest-expo unit tests (session storage, refresh, retry; English and Bangla keys; the Bangla typeface; the notification link table; the gym helpers) |
| `npm run api:sync` | Regenerate `src/lib/api/schema.d.ts` from `../kriraghor-backend/openapi.json` (`API_SPEC=<path or url>` for another branch) |
| `npx expo start --web` | A quick look in the browser at phone width (sessions are kept in memory there, so a reload signs out) |
| `npx expo export --platform android` | Bundle check without a device |

## Configuration

`app.config.ts` reads `APP_ENV`, `API_URL`, `REALTIME_URL`, `WEB_URL` and `GYM_URL`; `eas.json` sets them per build profile. There is no staging API yet, so **preview builds use the production API**:

| Profile | APP_ENV | API | Realtime (Socket.IO) | Web / gym links | Bundle ID |
|---|---|---|---|---|---|
| `development` | development | `http://10.0.2.2:4000/api/v1` | `http://10.0.2.2:4001` | `http://10.0.2.2:3000` / `http://10.0.2.2:3003` | `com.kriraghor.app.development` |
| `preview` | preview | `https://api.kriraghor.com/api/v1` | `https://kriraghor-realtime.onrender.com` | `https://kriraghor.com` / `https://gym.kriraghor.com` | `com.kriraghor.app.preview` |
| `production` | production | `https://api.kriraghor.com/api/v1` | `https://kriraghor-realtime.onrender.com` | `https://kriraghor.com` / `https://gym.kriraghor.com` | `com.kriraghor.app` |

**Realtime is its own service.** Socket.IO runs in the backend's `realtime.js` process, on Render at `kriraghor-realtime.onrender.com`; the API at `api.kriraghor.com` answers `/socket.io` with 404, so `REALTIME_URL` must never be the API's address (gym.kriraghor.com's `env.js` has the same value). `realtime.kriraghor.com` is not used: its DNS points at Vercel, and the owner chose to keep the onrender address (10 Nov 2026).

**Where the addresses come from.** A build bakes in its profile's `env` from `eas.json`. An over-the-air update carries its own copy: CI's `eas update` sets only `APP_ENV`, so an update ships the defaults in `app.config.ts`, and an app running an update reads those, not the ones from its build. Keep the defaults equal to the `preview` and `production` profiles (`src/lib/__tests__/config.test.ts` fails when they drift). Changing an address therefore reaches installed apps over the air; a new build is only needed so a fresh install has it on its very first launch.

The app version drives the OTA runtime (`runtimeVersion: appVersion`): bump `version` whenever a native module is added, so older installs never receive JS that needs it. A preview build of the current code: `npx eas-cli@latest build --profile preview --platform android` (uses the Expo account; ask first).

Run `npx eas-cli@latest init` once to create the EAS project and set `EAS_PROJECT_ID` (needed for push tokens).

## Screens

The app opens on the **hub**: a greeting and six tiles. **Esports** and **Gym** are sections inside the app, each with its own tabs; **Venues**, **Shop**, **Hire** and **Events** open kriraghor.com (`/venues`, `/shop`, `/hiring`, `/events`) in the in-app browser, where sign-in is the website's own. The last section chosen is kept on the phone (`kg.section`, `src/lib/section.ts`): a cold start opens it straight away, and **All sections** (a header button, the first item on Esports Home, a row in Account) forgets it and goes back to the hub. Notifications and links always open their own screen, whatever section is remembered.

**Guest browsing** (`src/lib/guest.ts`, `useGate`): like the websites, the hub, events, ranks, player pages, the gym directory and gym pages work signed out. Acting (register, buy a pass, join a gym, pay, check in) opens the sign-in modal, which closes back to the same screen and carries on with the action. Screens of the person's own things show a friendly Sign in (`SignedInOnly`, `SignInPrompt`) instead of an error.

**Shape and motion** (`src/constants/motion.ts`): radius 20 for tiles and cards, 12 for buttons, inputs and rows, pills fully round; an 8-pt rhythm. Reanimated only, transform and opacity only: press feedback springs to 0.97 (`AnimatedPressable`), entrances fade up 12 pt in 260 ms, 40 ms apart (`Reveal`), loading lists pulse (`Skeleton`), tabs crossfade, and the hub and a section zoom through each other (`src/components/transition.tsx`: the hub scales to 1.08 and fades in 220 ms, the section enters from 0.92 in 320 ms; All sections reverses it). Long option lists open in a bottom sheet (`src/components/sheet.tsx`: scrim, spring, drag to dismiss). Both sections share a floating glass tab bar with a sliding active pill (`src/components/tab-bar.tsx`; real Liquid Glass on iOS only when the binary has the module, a frosted approximation elsewhere). Success toasts: `useToast()`. Reduce motion turns all of it into plain fades or nothing.

| Route | What it does |
|---|---|
| `index` | The hub: a top bar (logo; Sign in, or my initials opening Account), a greeting in Dhaka time (Good morning, {first name}), six photo tiles (Esports as a wide hero), a note that the website tiles open kriraghor.com |
| `gyms`, `gyms/[slug]` | The public gym directory (area and monthly price chips, sort) and a gym's page (photos, open now, rating, map, facilities, hours, passes, the class timetable, **Book a free visit** while the gym takes visits) with **Buy a pass** (then `pay/[paymentId]`) and **Join this gym**, both gated on sign-in and a verified phone. A guest's first Gym tab is this directory |
| `sign-in` (modal) | M01 sign-in like kriraghor.com: password first (mobile, email or username, show/hide), **Get a one-time code instead** (six boxes, SMS autofill, 60 s resend), Forgot password (code, new password, then signed in with it), Create an account (code, then name, optional username with a live check, optional password). Closes back to where it was opened, else the hub. Rules in `src/lib/auth-flow.ts` |
| `(esports)/esports`, `events`, `matches`, `ranks`, `account` | Esports section tabs: Home, events, my matches, leaderboards and player pages (M21), Account |
| `(gym)/gym`, `gym/today`, `gym/checkin`, `gym/passes`, `gym/account` | Gym section tabs: My gyms, Today (today's workout and meals, then all my plans), Check-in, Passes, Account |
| Account (both sections, `src/components/account.tsx`) | Account, language, notifications, and rows for notifications, game IDs, squads, winnings, **Gym** (Esports only; badge: gym invites waiting) and All sections |
| `register/[id]`, `pay/[paymentId]`, `room/[matchId]`, `result/[matchId]`, `game-ids`, `squads`, `split/[registrationId]`, `winnings`, `payout-account`, `notifications` | Esports entry, paying (M06), room reveal, results and disputes, game IDs, squads, prize split, winnings and withdrawals, the bell |
| `gym` (tab) | My gyms: package, days left, what I owe with **Pay** (or "Pay at the counter"), invites badge, today's workout and meals, my check-in QR, past gyms, passes and trainers; no gyms: Find a gym on gym.kriraghor.com |
| `gym/requests` | Gym invites (what the gym will see, Accept, Decline), my join requests (Cancel), expired ones greyed |
| `gym/[memberId]` | One membership: packages and freezes, dues with Pay, payments, receipts (open on gym.kriraghor.com), plans, my points and the gym's rewards, my body (height, weight, BMI, blood group), health note, Unlink |
| `gym/classes` | My classes at my gym (M27-FR-48 to FR-50): the coming sessions with the places left, **Book a place**, **Join the waitlist**, **Cancel my place** |
| `gym/visit?slug=`, `gym/visits` | A free trial visit (M24 §17): pick a day and an arrival time inside the gym's hours (sign-in and a verified phone when tapped), then the visit's QR and 6-character code for the front desk, Cancel, and earlier visits |
| `gym/work` | My work, only for staff of a gym with `clock.in` (M27-FR-73, FR-81): whether I am in, today's shift, this month's time, **Scan to clock in / out** on the entrance QR, my payslips. Everything else a staff member does stays on gym.kriraghor.com |
| `gym/[memberId]/attendance` | Check-in calendar by month, Saturday first |
| `gym/plans/[assignmentId]` | Today first with Done ticks and notes (and the days back the API allows), the week, the whole plan, video links, the safety line |
| `gym/checkin` (tab) | My rotating QR (brightness up, screen awake) and scanning the gym's entrance QR with the camera |
| `gym/passes` (tab), `gym/subscriptions` | M20 passes (QR and backup code while active) and trainer subscriptions (renew, cancel, report on gym.kriraghor.com) |

The pay screen follows the payment's purpose: esports entries go back to Matches; gym fees say "Fee paid" and go back to the membership; passes and trainer months go back to their lists.

## Sessions (ADR-004)
Every request sends `X-Client-Type: mobile`, so sign-in and refresh return the refresh token in the body (no cookies, no CSRF). The refresh token is stored with `expo-secure-store` (Keychain or Keystore, this device only, after first unlock); the access token stays in memory. Refresh is single-flight, and a 401 `TOKEN_EXPIRED` or `AUTHZ_STALE` refreshes once and retries.

## Languages
English and Bangla (`src/i18n`). The app follows the phone's language until the user picks one in Account; the choice is kept on the device. `bn.ts` is typed from `en.ts`, so a missing key fails the typecheck, and a test checks every Bangla text is translated. Bangla text uses Hind Siliguri (`src/constants/fonts.ts`). User-facing names follow kriraghor-docs 04 §0: Venues, Events, Showcases.

## Push
`src/lib/notifications.ts` creates the Android channels the backend sends on (`urgent`: room ready, check-in open, security; `default`: everything else), asks permission when the user turns notifications on (never at launch) and gets the Expo push token. The token is registered with `POST /me/push-subscriptions`. A tap opens the screen for the notification's `link` (`src/lib/links.ts`): esports pages open their screens, gym member pages (`/me`, `/me/requests`, `/me/memberships/[id]`, `/me/dues`, `/me/plans/[id]`, `/me/checkin`, `/me/passes`, `/me/subscriptions`) open the gym screens, and the rest of gym.kriraghor.com (the owner panel, the directory, pay links, receipts) opens in the browser.
