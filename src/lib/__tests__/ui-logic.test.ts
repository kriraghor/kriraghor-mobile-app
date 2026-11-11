import { dayPart, dhakaHour, firstName, hubLive, initials, sheetDrag, sheetMounted, sheetPhase, sheetShouldDismiss, tabIndicator, type SheetEvent, type SheetPhase } from '../ui-logic';

describe('bottom sheet phases', () => {
  const run = (events: SheetEvent[], from: SheetPhase = 'closed') => events.reduce(sheetPhase, from);

  it('opens, settles, closes and unmounts', () => {
    expect(run(['show'])).toBe('opening');
    expect(run(['show', 'opened'])).toBe('open');
    expect(run(['show', 'opened', 'hide'])).toBe('closing');
    expect(run(['show', 'opened', 'hide', 'closed'])).toBe('closed');
  });

  it('can be shown again while closing, or hidden while opening', () => {
    expect(run(['show', 'opened', 'hide', 'show'])).toBe('opening');
    expect(run(['show', 'hide'])).toBe('closing');
  });

  it('ignores events that do not fit the phase', () => {
    expect(run(['hide'])).toBe('closed');
    expect(run(['closed'])).toBe('closed');
    expect(run(['opened'])).toBe('closed');
    expect(run(['show', 'opened', 'show'])).toBe('open');
    expect(run(['show', 'closed'])).toBe('opening');
    expect(run(['show', 'opened', 'hide', 'opened'])).toBe('closing');
  });

  it('stays mounted until fully closed', () => {
    expect((['closed', 'opening', 'open', 'closing'] as SheetPhase[]).map(sheetMounted)).toEqual([false, true, true, true]);
  });

  it('a fling down or a long pull dismisses; a fling up keeps it', () => {
    expect(sheetShouldDismiss(20, 1200, 600)).toBe(true);
    expect(sheetShouldDismiss(400, -1200, 600)).toBe(false);
    expect(sheetShouldDismiss(201, 0, 600)).toBe(true);
    expect(sheetShouldDismiss(199, 300, 600)).toBe(false);
    expect(sheetShouldDismiss(50, 0, 0)).toBe(false);
  });

  it('follows the finger down and resists upwards', () => {
    expect(sheetDrag(120)).toBe(120);
    expect(sheetDrag(0)).toBe(0);
    expect(sheetDrag(-100)).toBe(-20);
  });
});

describe('tab bar indicator', () => {
  it('equal slots inside the padding', () => {
    expect(tabIndicator(0, 5, 366)).toEqual({ x: 6, width: 70.8 });
    expect(tabIndicator(4, 5, 366).x).toBeCloseTo(6 + 4 * 70.8);
    expect(tabIndicator(2, 4, 400, 0)).toEqual({ x: 200, width: 100 });
  });

  it('clamps the index and handles an unmeasured bar', () => {
    expect(tabIndicator(9, 5, 366).x).toBeCloseTo(6 + 4 * 70.8);
    expect(tabIndicator(-1, 5, 366).x).toBe(6);
    expect(tabIndicator(0, 5, 0)).toEqual({ x: 0, width: 0 });
    expect(tabIndicator(0, 0, 300)).toEqual({ x: 0, width: 0 });
    expect(tabIndicator(0, 2, 10, 6)).toEqual({ x: 6, width: 0 });
  });
});

describe('greeting', () => {
  const at = (iso: string) => new Date(iso);

  it('uses Dhaka time (UTC+6)', () => {
    expect(dhakaHour(at('2026-10-30T20:30:00Z'))).toBe(2);
    expect(dhakaHour(at('2026-10-30T02:00:00Z'))).toBe(8);
  });

  it('morning, afternoon and evening', () => {
    expect(dayPart(at('2026-10-30T22:00:00Z'))).toBe('morning'); // 04:00 Dhaka
    expect(dayPart(at('2026-10-31T05:59:00Z'))).toBe('morning'); // 11:59
    expect(dayPart(at('2026-10-31T06:00:00Z'))).toBe('afternoon'); // 12:00
    expect(dayPart(at('2026-10-31T10:59:00Z'))).toBe('afternoon'); // 16:59
    expect(dayPart(at('2026-10-31T11:00:00Z'))).toBe('evening'); // 17:00
    expect(dayPart(at('2026-10-30T21:59:00Z'))).toBe('evening'); // 03:59
  });

  it('first name and initials', () => {
    expect(firstName('  Rafi Ahmed Khan ')).toBe('Rafi');
    expect(firstName(null)).toBe('');
    expect(initials('Rafi Ahmed Khan')).toBe('RK');
    expect(initials('rafi')).toBe('R');
    expect(initials('রাফি আহমেদ')).toBe('রআ');
    expect(initials('')).toBe('');
    expect(initials(undefined)).toBe('');
  });
});

describe('hub live chips', () => {
  it('shows the number of open tournaments, and nothing when none are open or the list is not known yet', () => {
    expect(hubLive({ openEvents: 3, gymDaysLeft: [] }).esports).toBe(3);
    expect(hubLive({ openEvents: 0, gymDaysLeft: [] }).esports).toBeNull();
    expect(hubLive({ openEvents: null, gymDaysLeft: [] }).esports).toBeNull();
  });
  it('shows the fewest days left across my gyms, counting the last day as 0', () => {
    expect(hubLive({ openEvents: null, gymDaysLeft: [12, 4, 30] }).gym).toBe(4);
    expect(hubLive({ openEvents: null, gymDaysLeft: [0, 9] }).gym).toBe(0);
  });
  it('ignores gyms without a package and days that already passed', () => {
    expect(hubLive({ openEvents: null, gymDaysLeft: [null, -2] }).gym).toBeNull();
    expect(hubLive({ openEvents: null, gymDaysLeft: [null, 7] }).gym).toBe(7);
    expect(hubLive({ openEvents: null, gymDaysLeft: [] }).gym).toBeNull();
  });
});
