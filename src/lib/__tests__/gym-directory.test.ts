import { activeFilterCount, gymListParams, joinablePackages, joinState, NO_FILTERS, passDates, ratingText, searchAreas, weekOf } from '../gym-directory';

const G = 'g1';
const hours = [
  { dow: 6, openTime: '17:00', closeTime: '22:00', womenOnly: false },
  { dow: 6, openTime: '06:00', closeTime: '10:00', womenOnly: true },
  { dow: 1, openTime: '06:00', closeTime: '22:00', womenOnly: false },
];

describe('the gym directory query', () => {
  it('sorts by price by default, 24 at a time', () => expect(gymListParams({})).toEqual({ limit: 24, sort: 'price' }));
  it('area, sort, a monthly cap in taka (sent as poisha) and the next page', () => {
    expect(gymListParams({ areaId: 'a1', sort: 'rating', priceMaxTaka: 2500, cursor: 'c2' }, 10)).toEqual({ limit: 10, sort: 'rating', areaId: 'a1', priceMax: 250000, cursor: 'c2' });
  });
  it('ignores an unknown sort and a zero cap', () => expect(gymListParams({ sort: 'nearest' as never, priceMaxTaka: 0 })).toEqual({ limit: 24, sort: 'price' }));
});

describe("a gym's week and pass dates", () => {
  it('Saturday first, windows in time order', () => {
    const w = weekOf(hours);
    expect(w.map((d) => d.dow)).toEqual([6, 0, 1, 2, 3, 4, 5]);
    expect(w[0].windows.map((x) => x.openTime)).toEqual(['06:00', '17:00']);
    expect(w[1].windows).toEqual([]);
  });

  it('a day pass only on open days; a longer pass on any day ahead', () => {
    // 2026-10-31 is a Saturday, 2026-11-02 a Monday.
    expect(passDates('day', hours, '2026-10-31', 4)).toEqual(['2026-10-31', '2026-11-02']);
    expect(passDates('month', hours, '2026-10-31', 3)).toEqual(['2026-10-31', '2026-11-01', '2026-11-02']);
    expect(passDates('day', hours, '2026-10-31', 0)).toEqual([]);
  });
});

describe('joining a gym', () => {
  it('only packages sold online, not day passes', () => {
    const p = [{ id: '1', kind: 'day' }, { id: '2', kind: 'month', channel: 'desk' }, { id: '3', kind: 'month', channel: 'both' }, { id: '4', kind: 'quarter' }];
    expect(joinablePackages(p).map((x) => x.id)).toEqual(['3', '4']);
  });

  it('a linked member, a request waiting, or free to ask', () => {
    const member = { memberId: 'm1', linked: true, status: 'active', gym: { id: G } };
    expect(joinState(G, [member], [])).toEqual({ kind: 'member', memberId: 'm1' });
    expect(joinState(G, [{ ...member, status: 'left' }, { ...member, linked: false }], [{ id: 'r', direction: 'join_request', status: 'pending', gym: { id: G } }])).toEqual({ kind: 'pending' });
    expect(joinState(G, [{ ...member, gym: { id: 'other' } }], [{ id: 'r', direction: 'invite', status: 'pending', gym: { id: G } }, { id: 's', direction: 'join_request', status: 'declined', gym: { id: G } }])).toEqual({ kind: 'open' });
    expect(joinState(G, undefined, undefined)).toEqual({ kind: 'open' });
    expect(joinState(G, [{ ...member, gym: null }], [{ id: 'r', direction: 'join_request', status: 'pending', gym: null }])).toEqual({ kind: 'open' });
  });
});

describe('ratingText', () => {
  it('one decimal, or nothing for a new gym', () => {
    expect(ratingText(4.649, 12)).toBe('4.6');
    expect(ratingText(5, 1)).toBe('5.0');
    expect(ratingText(null, 0)).toBeNull();
    expect(ratingText(4, 0)).toBeNull();
  });
});

describe('the filters sheet', () => {
  it('counts area and price, not the sort', () => {
    expect(activeFilterCount(NO_FILTERS)).toBe(0);
    expect(activeFilterCount({ sort: 'rating' })).toBe(0);
    expect(activeFilterCount({ sort: 'price', areaId: 'a' })).toBe(1);
    expect(activeFilterCount({ sort: 'newest', areaId: 'a', priceMaxTaka: 2500 })).toBe(2);
  });

  it('searches areas in English or Bangla', () => {
    const areas = [
      { id: '1', nameEn: 'Mirpur', nameBn: 'মিরপুর' },
      { id: '2', nameEn: 'Uttara', nameBn: 'উত্তরা' },
    ];
    expect(searchAreas(areas, '')).toHaveLength(2);
    expect(searchAreas(areas, ' mir ').map((a) => a.id)).toEqual(['1']);
    expect(searchAreas(areas, 'উত্ত').map((a) => a.id)).toEqual(['2']);
    expect(searchAreas(areas, 'xyz')).toEqual([]);
  });
});
