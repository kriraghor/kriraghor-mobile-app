import { bn } from '../bn';
import { en } from '../en';

type Tree = { [key: string]: string | Tree };

function leaves(tree: Tree, prefix = ''): [string, string][] {
  return Object.entries(tree).flatMap(([k, v]) => (typeof v === 'string' ? [[`${prefix}${k}`, v] as [string, string]] : leaves(v, `${prefix}${k}.`)));
}

describe('English and Bangla texts', () => {
  const enLeaves = leaves(en as unknown as Tree);
  const bnLeaves = leaves(bn as unknown as Tree);

  it('have exactly the same keys', () => {
    expect(bnLeaves.map(([k]) => k).sort()).toEqual(enLeaves.map(([k]) => k).sort());
  });

  it('have no empty text', () => {
    expect([...enLeaves, ...bnLeaves].filter(([, v]) => !v.trim())).toEqual([]);
  });

  it('are translated: every Bangla text has Bangla letters, except names kept as they are', () => {
    const KEPT = new Set<string>(['result.rank']); // symbols and names that stay as they are
    const untranslated = bnLeaves.filter(([k, v]) => !KEPT.has(k) && !/[ঀ-৿]/.test(v));
    expect(untranslated).toEqual([]);
  });

  it('use the names people see: Events and Venues, never tournaments or grounds', () => {
    const english = enLeaves.map(([, v]) => v).join(' ');
    expect(english).not.toMatch(/tournament|ground/i);
  });
});
