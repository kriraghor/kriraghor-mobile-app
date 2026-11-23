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

  it('use the names people see: Tournaments and Venues, never grounds (3 Nov 2026)', () => {
    const english = enLeaves.map(([, v]) => v).join(' ');
    expect(english).toMatch(/Tournaments/);
    expect(english).not.toMatch(/ground/i);
  });

  it('call a gym package a pass, never a subscription; subscription is only for trainers (gymSubs, 23 Nov 2026)', () => {
    const TRAINER = 'gymSubs.'; // a fitness trainer's monthly plan keeps the word subscription
    const says = ([k, v]: [string, string]) => !k.startsWith(TRAINER) && /subscription|সাবস্ক্রিপশন/i.test(v);
    expect([...enLeaves, ...bnLeaves].filter(says)).toEqual([]);
    // the trainer namespace still says it, so the check above would notice a renamed namespace
    expect(enLeaves.some(([k, v]) => k.startsWith(TRAINER) && /subscription/i.test(v))).toBe(true);
    expect(bnLeaves.some(([k, v]) => k.startsWith(TRAINER) && /সাবস্ক্রিপশন/.test(v))).toBe(true);
    // the gym package texts use the new word in both languages
    const en_ = Object.fromEntries(enLeaves);
    const bn_ = Object.fromEntries(bnLeaves);
    for (const k of ['gymPasses.title', 'gymPage.buyTitle', 'gymRenew.title', 'gymDir.myPasses']) {
      expect(en_[k]).toMatch(/\bpass(es)?\b/i);
      expect(bn_[k]).toMatch(/পাস/);
    }
  });

  it('keep the same placeholders in English and Bangla', () => {
    const holes = (v: string) => (v.match(/{{\s*\w+\s*}}/g) ?? []).map((h) => h.replace(/\s/g, '')).sort();
    const bn_ = new Map(bnLeaves);
    const differ = enLeaves.filter(([k, v]) => JSON.stringify(holes(v)) !== JSON.stringify(holes(bn_.get(k) ?? '')));
    expect(differ.map(([k]) => k)).toEqual([]);
  });
});
