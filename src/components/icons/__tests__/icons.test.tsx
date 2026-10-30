import { create, act } from 'react-test-renderer';
import { GLYPHS, type GlyphElement, type IconName } from '../glyphs';
import { Icon } from '../Icon';

const NAMES = Object.keys(GLYPHS) as IconName[];
const glyph = (n: IconName) => GLYPHS[n] as readonly GlyphElement[];

describe('the app icon set', () => {
  it('has the section, tab and UI glyphs', () => {
    for (const n of ['esports', 'gym', 'venues', 'shop', 'hire', 'events', 'home', 'matches', 'ranks', 'account', 'today', 'checkin', 'passes', 'sections', 'eye', 'eye-off'] as IconName[]) {
      expect(NAMES).toContain(n);
    }
  });

  it.each(NAMES)('%s uses only the five element kinds, numbers inside the 24 grid', (name) => {
    expect(glyph(name).length).toBeGreaterThan(0);
    for (const el of glyph(name)) {
      expect(['p', 'c', 'r', 'd', 'f']).toContain(el[0]);
      if (el[0] === 'p' || el[0] === 'f') {
        expect(el).toHaveLength(2);
        expect(typeof el[1]).toBe('string');
        expect(el[1]).toMatch(/^M[\d\s.,MmLlHhVvCcSsQqTtAaZz-]+$/);
      } else {
        expect(el).toHaveLength(el[0] === 'r' ? 6 : 4);
        for (const v of el.slice(1) as number[]) {
          expect(typeof v).toBe('number');
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(24);
        }
      }
    }
  });

  it.each(NAMES)('%s renders, plain and active, without throwing', (name) => {
    act(() => {
      create(<Icon name={name} color="#0B7A4B" />);
      create(<Icon name={name} color="#FFFFFF" size={32} active accessibilityLabel={name} />);
    });
  });
});
