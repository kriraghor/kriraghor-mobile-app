/// <reference types="jest" />
import { payDoneRoute } from '../gym';
import { linkToRoute } from '../links';
import { HUB, SECTION_HOME } from '../section';

// Node's fs and path, typed here (the app has no @types/node).
type Dirent = { name: string; isDirectory(): boolean };
const fs = jest.requireActual<{ readdirSync(dir: string, opts: { withFileTypes: true }): Dirent[] }>('fs');
const path = jest.requireActual<{ join(...parts: string[]): string; relative(from: string, to: string): string; sep: string }>('path');
declare const __dirname: string;

jest.mock('expo-constants', () => ({ expoConfig: { extra: { gymUrl: 'https://gym.kriraghor.com' } } }));

/**
 * Every app route the code sends people to (notification links, the hub's sections, the screens a
 * payment returns to) is a screen in src/app, after the route groups (esports) and (gym) and the
 * hub. Group names never appear in a URL, so renaming a group must not break a link.
 */
const APP = path.join(__dirname, '..', '..', 'app');

function routeFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) return routeFiles(full);
    return /\.tsx$/.test(d.name) && !d.name.startsWith('_') ? [full] : [];
  });
}

/** src/app/(gym)/gym/index.tsx → /gym; src/app/(esports)/events/[id].tsx → /events/[id]. */
function urlOf(file: string): string {
  const segs = path
    .relative(APP, file)
    .replace(/\.tsx$/, '')
    .split(path.sep)
    .filter((s) => !/^\(.+\)$/.test(s));
  if (segs[segs.length - 1] === 'index') segs.pop();
  return `/${segs.join('/')}`;
}

const ROUTES = routeFiles(APP).map(urlOf);
const PATTERNS = ROUTES.map((r) => ({ r, re: new RegExp(`^${r.replace(/\[[^\]]+\]/g, '[^/]+')}$`) }));

/** The route a URL opens: static routes win over dynamic ones, like expo-router. */
function match(url: string): string | null {
  const p = url.split('?')[0];
  const hits = PATTERNS.filter(({ re }) => re.test(p)).map(({ r }) => r);
  return hits.find((r) => !r.includes('[')) ?? hits[0] ?? null;
}

const M = '0192f0a4-1111-7aaa-8bbb-123456789abc';

describe('app routes', () => {
  it('no two screens share a URL', () => {
    const dupes = ROUTES.filter((r, i) => ROUTES.indexOf(r) !== i);
    expect(dupes).toEqual([]);
  });

  it('the hub is the first screen, and each section has its own first screen', () => {
    expect(match(HUB)).toBe('/');
    expect(match(SECTION_HOME.esports)).toBe('/esports');
    expect(match(SECTION_HOME.gym)).toBe('/gym');
  });

  it('the Gym tabs keep their /gym paths, next to the detail screens', () => {
    expect(match('/gym/today')).toBe('/gym/today');
    expect(match('/gym/checkin')).toBe('/gym/checkin');
    expect(match('/gym/passes?code=GP-7KQ2')).toBe('/gym/passes');
    expect(match('/gym/account')).toBe('/gym/account');
    expect(match(`/gym/${M}`)).toBe('/gym/[memberId]');
    expect(match(`/gym/${M}/attendance`)).toBe('/gym/[memberId]/attendance');
  });

  it.each([
    `https://esports.kriraghor.com/me/matches/${M}/room`,
    `https://esports.kriraghor.com/me/matches/${M}/result`,
    'https://esports.kriraghor.com/me/matches',
    'https://esports.kriraghor.com/events/ff-daily-abc123',
    'https://esports.kriraghor.com/me/esports/profiles',
    'https://esports.kriraghor.com/me/winnings',
    'https://esports.kriraghor.com/me/esports/squads',
    'https://kriraghor.com/me/payout-account',
    '/p/rafi.ff',
    'https://gym.kriraghor.com/me',
    'https://gym.kriraghor.com/me/requests',
    `https://gym.kriraghor.com/me/memberships/${M}`,
    `https://gym.kriraghor.com/me/plans/${M}`,
    'https://gym.kriraghor.com/me/checkin',
    'https://gym.kriraghor.com/me/passes/GP-7KQ2',
    'https://gym.kriraghor.com/me/subscriptions',
    '/anything-else',
  ])('a notification link opens a real screen: %s', (link) => {
    const to = linkToRoute(link);
    expect(typeof to).toBe('string');
    expect(match(to as string)).not.toBeNull();
  });

  it.each([['gym_fee', M], ['gym_fee', null], ['gym_pass', null], ['trainer', null], ['entry', null]] as const)('a payment of kind %s returns to a real screen', (kind, memberId) => {
    expect(match(payDoneRoute(kind, memberId))).not.toBeNull();
  });
});
