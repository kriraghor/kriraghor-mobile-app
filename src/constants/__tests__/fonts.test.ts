import { withTypeface } from '../fonts';

// jest hoists this above the import.
jest.mock('@expo-google-fonts/hind-siliguri', () => ({
  HindSiliguri_400Regular: 1,
  HindSiliguri_500Medium: 2,
  HindSiliguri_600SemiBold: 3,
  HindSiliguri_700Bold: 4,
}));

describe('the Bangla typeface', () => {
  it('leaves English styles alone', () => {
    const style = { fontSize: 16, fontWeight: '700' as const };
    expect(withTypeface(style, 'en')).toBe(style);
  });

  it('maps each weight to a Hind Siliguri face and drops fontWeight', () => {
    expect(withTypeface({ fontWeight: '800' }, 'bn')).toEqual({ fontFamily: 'HindSiliguri_700Bold', fontWeight: undefined });
    expect(withTypeface({ fontWeight: '600' }, 'bn')).toMatchObject({ fontFamily: 'HindSiliguri_600SemiBold' });
    expect(withTypeface({ fontWeight: 500 }, 'bn')).toMatchObject({ fontFamily: 'HindSiliguri_500Medium' });
    expect(withTypeface({ fontSize: 14 }, 'bn')).toMatchObject({ fontFamily: 'HindSiliguri_400Regular', fontSize: 14 });
    expect(withTypeface(undefined, 'bn')).toMatchObject({ fontFamily: 'HindSiliguri_400Regular' });
  });

  it('keeps a font chosen on purpose (monospace codes)', () => {
    const style = { fontFamily: 'monospace', fontWeight: '700' as const };
    expect(withTypeface(style, 'bn')).toBe(style);
  });
});
