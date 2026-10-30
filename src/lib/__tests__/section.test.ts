import { parseSection, SECTION_HOME, SECTION_KEY, sectionMemory, setStartSection, startRoute, startSection, tileTarget, TILES, type KeyValueStore } from '../section';

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: async (k) => data.get(k) ?? null,
    set: async (k, v) => void data.set(k, v),
    remove: async (k) => void data.delete(k),
  };
}

const broken: KeyValueStore = {
  get: () => Promise.reject(new Error('keystore locked')),
  set: () => Promise.reject(new Error('keystore locked')),
  remove: () => Promise.reject(new Error('keystore locked')),
};

describe('the hub tiles', () => {
  it('six tiles: the two app sections first, then the website pages', () => {
    expect(TILES.map((t) => t.key)).toEqual(['esports', 'gym', 'venues', 'shop', 'hire', 'events']);
  });

  it('a section tile opens its first screen', () => {
    expect(tileTarget(TILES[0], 'https://kriraghor.com')).toEqual({ section: 'esports', route: '/esports' });
    expect(tileTarget(TILES[1], 'https://kriraghor.com')).toEqual({ section: 'gym', route: '/gym' });
  });

  it('the others open kriraghor.com pages (Venues, Shop, Hire, Events)', () => {
    const web = TILES.slice(2).map((t) => tileTarget(t, 'https://kriraghor.com/'));
    expect(web).toEqual([
      { external: 'https://kriraghor.com/venues' },
      { external: 'https://kriraghor.com/shop' },
      { external: 'https://kriraghor.com/hiring' },
      { external: 'https://kriraghor.com/events' },
    ]);
  });
});

describe('the remembered section', () => {
  it('only esports or gym', () => {
    expect(parseSection('esports')).toBe('esports');
    expect(parseSection('gym')).toBe('gym');
    expect(parseSection('shop')).toBeNull();
    expect(parseSection(null)).toBeNull();
    expect(parseSection(undefined)).toBeNull();
  });

  it('a cold start opens it, else the hub', () => {
    expect(startRoute('esports')).toBe(SECTION_HOME.esports);
    expect(startRoute('gym')).toBe('/gym');
    expect(startRoute(null)).toBe('/');
  });

  it('is kept, read back and forgotten under kg.section', async () => {
    const store = memoryStore();
    const mem = sectionMemory(store);
    expect(await mem.load()).toBeNull();
    await mem.remember('gym');
    expect(store.data.get(SECTION_KEY)).toBe('gym');
    expect(await mem.load()).toBe('gym');
    await mem.forget();
    expect(await mem.load()).toBeNull();
  });

  it('ignores a value it does not know', async () => {
    const store = memoryStore();
    store.data.set(SECTION_KEY, 'venues');
    expect(await sectionMemory(store).load()).toBeNull();
  });

  it('a storage failure means the hub, never a crash', async () => {
    const mem = sectionMemory(broken);
    await expect(mem.load()).resolves.toBeNull();
    await expect(mem.remember('esports')).resolves.toBeUndefined();
    await expect(mem.forget()).resolves.toBeUndefined();
  });
});

describe('the start section', () => {
  it('reading it twice gives the same answer (a render may run twice)', () => {
    setStartSection('gym');
    expect(startSection()).toBe('gym');
    expect(startSection()).toBe('gym');
  });

  it('cleared once used, or by a launch that opened another screen', () => {
    setStartSection('esports');
    setStartSection(null);
    expect(startSection()).toBeNull();
  });
});
