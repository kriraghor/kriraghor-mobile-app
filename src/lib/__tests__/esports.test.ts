import { currentMatch, entryActions, eventCta, revealAt, type Registration } from '../esports';

const event = { status: 'registration_open' as const, maxSlots: 12, slotsTaken: 7, registrationOpensAt: '2026-10-21T10:00:00Z', entryPolicy: 'open' as const };
const reg = (over: Partial<Registration>): Registration => ({
  id: 'r1',
  tournamentId: 't1',
  registrantUserId: 'u1',
  squadId: null,
  slotNo: 3,
  status: 'confirmed',
  amount: { amount: 5000, currency: 'BDT' },
  paymentId: 'p1',
  holdExpiresAt: null,
  offerExpiresAt: null,
  waitlistPosition: null,
  ...over,
});

describe('the event page action (M21-FR-08 to FR-10)', () => {
  it('register while there are slots, waitlist when full', () => {
    expect(eventCta(event, null)).toEqual({ kind: 'register' });
    expect(eventCta({ ...event, slotsTaken: 12 }, null)).toEqual({ kind: 'waitlist' });
  });
  it('an entry the player already has wins over everything', () => {
    const mine = reg({ status: 'waitlisted' });
    expect(eventCta({ ...event, slotsTaken: 12 }, mine)).toEqual({ kind: 'registered', registration: mine });
    expect(eventCta(event, reg({ status: 'withdrawn' }))).toEqual({ kind: 'register' });
  });
  it('not open yet, closed, invite only', () => {
    expect(eventCta({ ...event, status: 'scheduled' }, null)).toEqual({ kind: 'opens_later', at: event.registrationOpensAt });
    expect(eventCta({ ...event, status: 'check_in' }, null)).toEqual({ kind: 'closed' });
    expect(eventCta({ ...event, entryPolicy: 'invite' }, null)).toEqual({ kind: 'invite_only' });
  });
});

describe('My matches actions (same rules as the website)', () => {
  const t = (status: string) => ({ id: 't1', slug: 's', titleEn: 'Cup', titleBn: 'কাপ', status: status as never, startsAt: '2026-10-22T14:00:00Z', entryUnit: 'player' as const });
  const m = (status: string, seq = 1) => ({ id: `m${seq}`, seq, startsAt: '2026-10-22T14:00:00Z', status: status as never });

  it('pay, take the offered slot, withdraw while it is still allowed', () => {
    expect(entryActions(reg({ status: 'pending_payment', tournament: t('registration_open') }))).toEqual(['pay', 'withdraw']);
    expect(entryActions(reg({ status: 'offered', tournament: t('registration_open') }))).toEqual(['take_slot', 'withdraw']);
    expect(entryActions(reg({ status: 'waitlisted', tournament: t('live') }))).toEqual([]);
  });

  it('check in only during check-in, then the room once revealed (or ready for a checked-in entry)', () => {
    expect(entryActions(reg({ status: 'confirmed', tournament: t('check_in'), matches: [m('scheduled')] }))).toEqual(['check_in', 'withdraw']);
    expect(entryActions(reg({ status: 'checked_in', tournament: t('check_in'), matches: [m('room_ready')] }))).toEqual(['room']);
    expect(entryActions(reg({ status: 'confirmed', tournament: t('check_in'), matches: [m('room_ready')] }))).toEqual(['check_in', 'withdraw']);
    expect(entryActions(reg({ status: 'checked_in', tournament: t('live'), matches: [m('live')] }))).toEqual(['room']);
  });

  it('results once posted; a series looks at the first unfinished match', () => {
    expect(entryActions(reg({ status: 'checked_in', tournament: t('results_pending'), matches: [m('results_pending')] }))).toEqual(['result']);
    const series = reg({ status: 'checked_in', tournament: t('live'), matches: [m('room_revealed', 2), m('final', 1)] });
    expect(currentMatch(series)?.seq).toBe(2);
    expect(entryActions(series)).toEqual(['room']);
    expect(currentMatch(reg({ matches: [m('final', 1), m('final', 2)] }))?.seq).toBe(2);
    expect(currentMatch(reg({}))).toBeNull();
  });

  it('a payment-less pending entry shows no pay button', () => {
    expect(entryActions(reg({ status: 'pending_payment', paymentId: null, tournament: t('registration_open') }))).toEqual(['withdraw']);
  });
});

it('the room shows 15 minutes before the match by default', () => {
  expect(revealAt('2026-10-22T14:00:00.000Z')).toBe('2026-10-22T13:45:00.000Z');
  expect(revealAt('2026-10-22T14:00:00.000Z', 30)).toBe('2026-10-22T13:30:00.000Z');
});
