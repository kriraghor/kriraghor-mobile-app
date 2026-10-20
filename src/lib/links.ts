/**
 * Notification links (M08 push and the bell) point at the websites, e.g.
 * https://esports.kriraghor.com/me/matches/{matchId}/room. The app opens the matching screen;
 * anything it has no screen for opens the notifications list, so a tap never lands nowhere.
 */
const UUID = '[0-9a-fA-F-]{36}';

const RULES: [RegExp, (m: RegExpMatchArray) => string][] = [
  [new RegExp(`^/me/matches/(${UUID})/room$`), (m) => `/room/${m[1]}`],
  [new RegExp(`^/me/matches/(${UUID})/result$`), (m) => `/result/${m[1]}`],
  [/^\/me\/matches\/?$/, () => '/matches'],
  [/^\/(?:events|tournaments)\/([\w-]+)$/, (m) => `/events/${m[1]}`],
  [/^\/me\/esports\/profiles\/?$/, () => '/game-ids'],
];

export function linkToRoute(link: string | null | undefined): string {
  if (!link) return '/notifications';
  let path = link;
  try {
    path = new URL(link, 'https://kriraghor.com').pathname;
  } catch {
    return '/notifications';
  }
  // Locale prefixes on the websites (/en/…, /bn/…) are not part of the app's routes.
  path = path.replace(/^\/(en|bn)(?=\/)/, '').replace(/\/+$/, '') || '/';
  for (const [re, to] of RULES) {
    const m = path.match(re);
    if (m) return to(m);
  }
  return '/notifications';
}
