import { config } from './config';

/**
 * Notification links (M08 push and the bell) point at the websites, e.g.
 * https://esports.kriraghor.com/me/matches/{matchId}/room. The app opens the matching screen;
 * anything it has no screen for opens the notifications list, so a tap never lands nowhere.
 *
 * Gym links (gym.kriraghor.com, M24-FR-103, FR-105): the member pages open the app's gym screens
 * (M24 §4.5); everything else on the gym host (the owner panel /manage, the directory /gyms,
 * /trainers, pay links /p/[token], receipts /r/[token], unknown pages) comes back as `{ external }`
 * and opens in the browser on the gym app. The host decides: /p/[handle] is an esports player
 * profile everywhere except on the gym host, where /p/[token] is a pay link.
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

/**
 * Gym member pages and the app screen each opens. `where` says which links may use the rule:
 * - `gym`: only a link on the gym host. A relative `/me` is kriraghor.com's account page (M06 escrow
 *   and team notices use it), so it stays out of the gym.
 * - `gym+relative`: the gym host, or the path arriving relative (no kriraghor.com page uses these).
 * - `any`: also on other hosts: kriraghor.com `/me/passes` and `/me/subscriptions` moved to the gym
 *   app (M24 §4.3), so older notifications still open the gym screens.
 */
type Where = 'gym' | 'gym+relative' | 'any';
const GYM_RULES: [RegExp, (m: RegExpMatchArray, query: URLSearchParams) => string, Where][] = [
  [/^\/me$/, () => '/gym', 'gym'],
  [/^\/me\/(?:dues|memberships|plans)$/, () => '/gym', 'gym+relative'],
  // A renewal reminder (M24-FR-127) carries ?renew=1 and opens the renew screen.
  [new RegExp(`^/me/memberships/(${UUID})$`), (m, query) => (query.get('renew') === '1' ? `/gym/renew?m=${m[1]}` : `/gym/${m[1]}`), 'gym+relative'],
  [/^\/me\/requests$/, () => '/gym/requests', 'gym+relative'],
  [new RegExp(`^/me/plans/(${UUID})$`), (m) => `/gym/plans/${m[1]}`, 'gym+relative'],
  [/^\/me\/checkin$/, () => '/gym/checkin', 'gym+relative'],
  [/^\/me\/classes$/, () => '/gym/classes', 'gym+relative'],
  [/^\/me\/visits$/, () => '/gym/visits', 'gym+relative'],
  // A staff member's own clock and payslips are in the app; the rest of /manage opens the gym site.
  [new RegExp(`^/manage/(${UUID})/my-work$`), (m) => `/gym/work?g=${m[1]}`, 'gym+relative'],
  [/^\/me\/passes$/, () => '/gym/passes', 'any'],
  [/^\/me\/passes\/([\w-]+)$/, (m) => `/gym/passes?code=${encodeURIComponent(m[1])}`, 'any'],
  [/^\/me\/subscriptions(?:\/[\w-]+)?$/, () => '/gym/subscriptions', 'any'],
];

/** Owner and directory pages of the gym app: they open there, also when a link arrives relative. */
const GYM_PATH = /^\/(?:manage|gyms)(?:\/|$)/;

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
  const site = host === null ? 'relative' : isGymHost(host, gymUrl) ? 'gym' : 'other';

  for (const [re, to, where] of GYM_RULES) {
    const allowed = where === 'any' || site === 'gym' || (where === 'gym+relative' && site === 'relative');
    const m = allowed ? path.match(re) : null;
    if (m) return to(m, url.searchParams);
  }
  if (site === 'gym' || GYM_PATH.test(path)) {
    const base = gymUrl.replace(/\/+$/, '');
    return { external: `${base}${path === '/' ? '' : path}${url.search}` };
  }
  // The tournament feed (M26) lives on kriraghor.com. Only the esports site's own old /tournaments
  // links are esports events.
  if (/^\/(?:me\/)?tournaments(?:\/|$)/.test(path) && !host?.startsWith('esports.')) {
    return { external: `${config.webUrl}${path}${url.search}` };
  }
  for (const [re, to] of RULES) {
    const m = path.match(re);
    if (m) return to(m);
  }
  return '/notifications';
}
