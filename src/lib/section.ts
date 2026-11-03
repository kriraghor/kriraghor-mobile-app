/**
 * The hub and its sections. The app opens on a grid of six tiles: two are sections inside the app
 * (Esports, Gym: each its own tabs), four open the website in the in-app browser (Venues, Shop, Hire,
 * Events). The last in-app section chosen is kept on the phone (`kg.section`); on a cold start the
 * app opens it straight away, otherwise the hub. "All sections" forgets it and shows the hub again.
 * Notifications and links never look at it: they open their own screen.
 *
 * Pure (the storage is passed in), so it is unit-tested without a phone.
 */
export type Section = 'esports' | 'gym';
export const SECTIONS: readonly Section[] = ['esports', 'gym'];
export const SECTION_KEY = 'kg.section';

/** The first screen of each section. */
export const SECTION_HOME = { esports: '/esports', gym: '/gym' } as const satisfies Record<Section, string>;
export const HUB = '/';

export const parseSection = (v: unknown): Section | null => (SECTIONS as readonly unknown[]).includes(v) ? (v as Section) : null;

export type TileKey = 'esports' | 'gym' | 'venues' | 'shop' | 'hire' | 'events';
export type Tile = { key: TileKey } & ({ section: Section } | { webPath: string });

/** The hub's tiles, in order: the two app sections first, then the website's pages (names people see). */
export const TILES: readonly Tile[] = [
  { key: 'esports', section: 'esports' },
  { key: 'gym', section: 'gym' },
  { key: 'venues', webPath: '/venues' },
  { key: 'shop', webPath: '/shop' },
  { key: 'hire', webPath: '/hiring' },
  { key: 'events', webPath: '/tournaments' },
];

export type TileTarget = { section: Section; route: (typeof SECTION_HOME)[Section] } | { external: string };

/** Where a tile goes: a section's first screen, or a kriraghor.com page in the in-app browser. */
export function tileTarget(tile: Tile, webUrl: string): TileTarget {
  if ('section' in tile) return { section: tile.section, route: SECTION_HOME[tile.section] };
  return { external: `${webUrl.replace(/\/+$/, '')}${tile.webPath}` };
}

/** The screen a cold start opens: the remembered section, or the hub. */
export const startRoute = (remembered: Section | null) => (remembered ? SECTION_HOME[remembered] : HUB);

export type KeyValueStore = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
};

/** Read, keep and forget the last section; storage failures never stop the app (it falls back to the hub). */
export function sectionMemory(store: KeyValueStore) {
  return {
    load: async (): Promise<Section | null> => parseSection(await store.get(SECTION_KEY).catch(() => null)),
    remember: (s: Section) => store.set(SECTION_KEY, s).catch(() => undefined),
    forget: () => store.remove(SECTION_KEY).catch(() => undefined),
  };
}

/**
 * The section to open once at a cold start. Set while the splash shows; the hub reads it on its first
 * mount (and redirects), then it is cleared, as it is when the first screen is not the hub, so a launch
 * from a notification or link opens that screen and a later visit to the hub stays on the hub.
 * Reading does not clear it (a render may run twice); clearing is an effect.
 */
let pending: Section | null = null;
export const setStartSection = (s: Section | null) => {
  pending = s;
};
export const startSection = (): Section | null => pending;
