import type { Registration } from '../esports';
import { canSplit, checkSplit, equalSplit, normaliseWallet, points, seasonLabel, splitPlayers, withdrawState, type PayoutAccount, type Withdrawable } from '../player';

describe('ranking display', () => {
  it('points to one decimal, whole numbers without .0', () => {
    expect(points(412.375)).toBe('412.4');
    expect(points(12)).toBe('12');
    expect(points(0.04)).toBe('0');
  });
  it('season keys as quarters, in both languages; anything else as it is', () => {
    expect(seasonLabel('2026-S4', 'en')).toBe('2026 · Oct–Dec');
    expect(seasonLabel('2026-S1', 'bn')).toBe('2026 · জানু–মার্চ');
    expect(seasonLabel('rolling', 'en')).toBe('rolling');
  });
});

describe('prize split (M21 §6.5)', () => {
  it('equal shares in whole percents, the remainder to the first listed', () => {
    expect(equalSplit(['a', 'b', 'c'])).toEqual([
      { userId: 'a', pct: 34 },
      { userId: 'b', pct: 33 },
      { userId: 'c', pct: 33 },
    ]);
    expect(equalSplit(['a', 'b', 'c', 'd']).map((s) => s.pct)).toEqual([25, 25, 25, 25]);
    expect(equalSplit([])).toEqual([]);
  });

  it('must list every player once, whole percents 0–100, summing to 100 (as the server)', () => {
    const ids = ['a', 'b'];
    expect(checkSplit([{ userId: 'a', pct: 60 }, { userId: 'b', pct: 40 }], ids)).toEqual({ ok: true });
    expect(checkSplit([{ userId: 'a', pct: 60 }, { userId: 'b', pct: 30 }], ids)).toEqual({ ok: false, reason: 'sum' });
    expect(checkSplit([{ userId: 'a', pct: 100 }], ids)).toEqual({ ok: false, reason: 'players' });
    expect(checkSplit([{ userId: 'a', pct: 50 }, { userId: 'a', pct: 50 }], ids)).toEqual({ ok: false, reason: 'players' });
    expect(checkSplit([{ userId: 'a', pct: 50.5 }, { userId: 'b', pct: 49.5 }], ids)).toEqual({ ok: false, reason: 'range' });
    expect(checkSplit([{ userId: 'a', pct: 120 }, { userId: 'b', pct: -20 }], ids)).toEqual({ ok: false, reason: 'range' });
  });

  const reg = (over: Partial<Registration>): Registration => ({
    id: 'r1',
    tournamentId: 't1',
    registrantUserId: 'me',
    squadId: 's1',
    slotNo: 1,
    status: 'confirmed',
    amount: { amount: 20000, currency: 'BDT' },
    paymentId: null,
    holdExpiresAt: null,
    offerExpiresAt: null,
    waitlistPosition: null,
    tournament: { id: 't1', slug: 's', titleEn: 'Cup', titleBn: 'কাপ', status: 'registration_open', startsAt: '2026-10-25T15:00:00Z', entryUnit: 'squad' },
    ...over,
  });
  const before = Date.parse('2026-10-25T14:00:00Z');

  it('only whoever registered a squad entry, while it is live, before the event starts', () => {
    expect(canSplit(reg({}), 'me', before)).toBe(true);
    expect(canSplit(reg({}), 'someone-else', before)).toBe(false);
    expect(canSplit(reg({}), undefined, before)).toBe(false);
    expect(canSplit(reg({}), 'me', Date.parse('2026-10-25T15:00:00Z'))).toBe(false);
    expect(canSplit(reg({ status: 'waitlisted' }), 'me', before)).toBe(false);
    expect(canSplit(reg({ tournament: { ...reg({}).tournament!, entryUnit: 'player' } }), 'me', before)).toBe(false);
  });

  it('substitutes are not part of the split', () => {
    const players = [
      { userId: 'a', isSubstitute: false },
      { userId: 'b', isSubstitute: true },
    ];
    expect(splitPlayers({ players } as never).map((p) => p.userId)).toEqual(['a']);
    expect(splitPlayers({} as never)).toEqual([]);
  });
});

describe('the Withdraw button (M21-FR-25, M07)', () => {
  const active: PayoutAccount = { id: 'pa', type: 'bkash', masked: 'bKash ••• 4321', accountName: 'Rafi', status: 'active', reviewNote: null, holdUntil: null, createdAt: '' };
  const pending: PayoutAccount = { ...active, status: 'pending_verification' };
  const avail = (o: Partial<Withdrawable> = {}): Withdrawable => ({ amount: 250000, withdrawable: 250000, dailyLeft: 5000000, minimum: 10000, ...o });
  const allowed = { action: 'withdraw_winnings', allowed: true };

  it('NID verification comes first (missing or under review)', () => {
    expect(withdrawState({ gate: { action: 'w', allowed: false, code: 'KYC_REQUIRED' }, accounts: [active], available: avail(), open: false })).toEqual({ kind: 'kyc', pending: false });
    expect(withdrawState({ gate: { action: 'w', allowed: false, code: 'KYC_PENDING' }, accounts: [], available: avail(), open: false })).toEqual({ kind: 'kyc', pending: true });
  });

  it('one open withdrawal at a time; nothing to withdraw', () => {
    expect(withdrawState({ gate: allowed, accounts: [active], available: avail(), open: true })).toEqual({ kind: 'open' });
    expect(withdrawState({ gate: allowed, accounts: [active], available: avail({ amount: 0 }), open: false })).toEqual({ kind: 'nothing' });
    expect(withdrawState({ gate: allowed, accounts: [active], available: null, open: false })).toEqual({ kind: 'nothing' });
  });

  it('needs an active payout account (a new one waits for finance)', () => {
    expect(withdrawState({ gate: allowed, accounts: [], available: avail(), open: false })).toEqual({ kind: 'account_missing' });
    expect(withdrawState({ gate: allowed, accounts: [pending], available: avail(), open: false })).toEqual({ kind: 'account_pending' });
  });

  it('the minimum and the daily cap; otherwise ready with the withdrawable amount', () => {
    expect(withdrawState({ gate: allowed, accounts: [active], available: avail({ withdrawable: 5000 }), open: false })).toEqual({ kind: 'below_minimum', minimum: 10000 });
    expect(withdrawState({ gate: allowed, accounts: [active], available: avail({ withdrawable: 0, dailyLeft: 0 }), open: false })).toEqual({ kind: 'daily_limit' });
    expect(withdrawState({ gate: allowed, accounts: [active], available: avail({ withdrawable: 0, dailyLeft: 300 }), open: false })).toEqual({ kind: 'below_minimum', minimum: 10000 });
    expect(withdrawState({ gate: allowed, accounts: [active, pending], available: avail({ withdrawable: 150000 }), open: false })).toEqual({ kind: 'ready', amount: 150000 });
    expect(withdrawState({ gate: null, accounts: [active], available: avail(), open: false })).toEqual({ kind: 'ready', amount: 250000 });
  });
});

it('bKash and Nagad numbers', () => {
  expect(normaliseWallet('01712345678')).toBe('01712345678');
  expect(normaliseWallet('+880 1712-345678')).toBe('01712345678');
  expect(normaliseWallet('8801912345678')).toBe('01912345678');
  expect(normaliseWallet('01212345678')).toBeNull();
  expect(normaliseWallet('0171234567')).toBeNull();
});
