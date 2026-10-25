import { config } from './config';

/**
 * Notification links (M08 push and the bell) point at the websites, e.g.
 * https://esports.kriraghor.com/me/matches/{matchId}/room. The app opens the matching screen;
 * anything it has no screen for opens the notifications list, so a tap never lands nowhere.
 *
 * Gym links (gym.kriraghor.com, M24-FR-103) have no screens in the app yet (M24 prompt 3b), so they
 * come back as `{ external }` and open in the browser on the gym app instead.
 */
const UUID = '[0-9a-fA-F-]{36}';

const RULES: [RegExp, (m: RegExpMatchArray) => string][] = [
  [new RegExp(`^/me/matches/(${UUID})/room$`), (m) => `/room/${m[1]}`],
  [new RegExp(`^/me/matches/(${UUID})/result$`), (m) => `/result/${m[1]}`],
  [/^\/me\/matches\/?$/, () => '/matches'],
  [/^\/(?:events|tournaments)\/([\w-]+)$/, (m) => `/events/${m[1]}`],
  [/^\/me\/esports\/profiles\/?$/, () => '/game-ids'],
  [/^\/me\/(?:esports\/)?winnings\/?$/, () => '/winnings'],
  [/^\/me\/(?:esports\/)?squads\/?$/, () => '/squads'],
  [/^\/me\/payout-account\/?$/, () => '/payout-account'],
  [/^\/p\/([\w.-]+)$/, (m) => `/ranks/${m[1]}`],
];

/** Paths that live on the gym app, also when a link arrives relative (older notifications). */
const GYM_PATH = /^\/(?:me\/passes|me\/subscriptions|manage|gyms)(?:\/|$)/;

/** An app route, or a website page to open in the browser. */
export type LinkTarget = string | { external: string };

function hostOf(url: string): string | null {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

/** The gym host from the build profile, plus gym.* on any Kriraghor environment (staging, local). */
function isGymHost(host: string, gymUrl: string): boolean {
  return host === hostOf(gymUrl) || /^gym\.(?:staging\.)?kriraghor\./.test(host);
}

export function linkToRoute(link: string | null | undefined, gymUrl: string = config.gymUrl): LinkTarget {
  if (!link) return '/notifications';
  let url: URL;
  try {
    url = new URL(link, 'https://kriraghor.com');
  } catch {
    return '/notifications';
  }
  // Locale prefixes on the websites (/en/…, /bn/…) are not part of the app's routes.
  const path = url.pathname.replace(/^\/(en|bn)(?=\/|$)/, '').replace(/\/+$/, '') || '/';
  const host = /^[a-z][\w+.-]*:/i.test(link) ? url.host.toLowerCase() : null;
  if ((host && isGymHost(host, gymUrl)) || GYM_PATH.test(path)) {
    const base = gymUrl.replace(/\/+$/, '');
    return { external: `${base}${path === '/' ? '' : path}${url.search}` };
  }
  for (const [re, to] of RULES) {
    const m = path.match(re);
    if (m) return to(m);
  }
  return '/notifications';
}
