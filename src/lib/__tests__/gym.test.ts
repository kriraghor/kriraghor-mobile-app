import {
  addDays,
  bookableDays,
  byDay,
  classAction,
  clockTime,
  clockWorkplaces,
  codeGroups,
  dhakaMinuteNow,
  hoursMinutes,
  splitVisits,
  visitTimes,
  canLog,
  cardPayState,
  dateOnly,
  dayIndexFor,
  daysBetween,
  dhakaToday,
  duePayState,
  entranceTokenFrom,
  findItem,
  groupsOn,
  latestTicks,
  linkedGyms,
  logDays,
  monthGrid,
  monthOf,
  monthTitle,
  payDoneRoute,
  payKind,
  planDayFor,
  progressOn,
  qrRefreshIn,
  requestState,
  safeVideo,
  secondsLeft,
  shiftMonth,
  splitDuration,
  splitRequests,
  textOf,
  tickKey,
  timeOnly,
  todayFirst,
  waitingInvites,
  weekdayOf,
  weekHeads,
  type Content,
} from '../gym';

describe('Dhaka dates', () => {
  it('today is the Dhaka date, whatever the phone zone', () => {
    expect(dhakaToday(Date.parse('2026-10-28T17:59:00Z'))).toBe('2026-10-28'); // 23:59 in Dhaka
    expect(dhakaToday(Date.parse('2026-10-28T18:00:00Z'))).toBe('2026-10-29'); // midnight in Dhaka
    expect(dhakaToday(new Date('2026-12-31T20:00:00Z'))).toBe('2027-01-01');
    expect(dhakaToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('adds days and counts between dates, across months and years', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(daysBetween('2026-10-01', '2026-10-29')).toBe(28);
    expect(monthOf('2026-10-29')).toBe('2026-10');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('formats a date only, in English and Bangla, with or without the weekday and year', () => {
    expect(dateOnly('2026-10-22')).toBe('22 Oct 2026');
    expect(dateOnly('2026-10-22', 'bn')).toBe('২২ অক্টো ২০২৬');
    expect(dateOnly('2026-10-22', 'en', { weekday: true })).toBe('Thu 22 Oct 2026');
    expect(dateOnly('2026-10-22', 'bn', { weekday: true, year: false })).toBe('বৃহস্পতি ২২ অক্টো');
    // An instant is read in Dhaka: 20:00 UTC on the 22nd is the 23rd in Dhaka.
    expect(dateOnly('2026-10-22T20:00:00.000Z')).toBe('23 Oct 2026');
  });

  it('formats a time in Dhaka, with the Bangla part of the day', () => {
    expect(timeOnly('2026-10-22T00:05:00Z')).toBe('6:05 am');
    expect(timeOnly('2026-10-22T06:00:00Z')).toBe('12:00 pm');
    expect(timeOnly('2026-10-22T18:30:00Z')).toBe('12:30 am');
    expect(timeOnly('2026-10-22T20:00:00Z', 'bn')).toBe('রাত ২:০০');
    expect(timeOnly('2026-10-22T02:00:00Z', 'bn')).toBe('সকাল ৮:০০');
    expect(timeOnly('2026-10-22T07:00:00Z', 'bn')).toBe('দুপুর ১:০০');
    expect(timeOnly('2026-10-22T10:00:00Z', 'bn')).toBe('বিকেল ৪:০০');
    expect(timeOnly('2026-10-22T12:30:00Z', 'bn')).toBe('সন্ধ্যা ৬:৩০');
    expect(timeOnly('2026-10-22T15:00:00Z', 'bn')).toBe('রাত ৯:০০');
  });

  it('names weekdays and months', () => {
    expect(weekdayOf('2026-10-31')).toBe('Sat');
    expect(weekdayOf('2026-10-31', 'bn')).toBe('শনি');
    expect(monthTitle('2026-10')).toBe('October 2026');
    expect(monthTitle('2026-02', 'bn')).toBe('ফেব্রুয়ারি ২০২৬');
    expect(weekHeads()).toEqual(['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    expect(weekHeads('bn')[0]).toBe('শনি');
  });
});

describe('the check-in calendar (Saturday first)', () => {
  it('pads October 2026 (starts on a Thursday) and marks the days I came', () => {
    const weeks = monthGrid('2026-10', ['2026-10-01', '2026-10-29']);
    expect(weeks).toHaveLength(6);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0].slice(0, 5)).toEqual([null, null, null, null, null]); // Sat to Wed empty
    expect(weeks[0][5]).toEqual({ date: '2026-10-01', day: 1, label: '1', came: true });
    expect(weeks[0][6]).toMatchObject({ date: '2026-10-02', came: false });
    expect(weeks[4].map((c) => c!.day)).toEqual([24, 25, 26, 27, 28, 29, 30]);
    expect(weeks[5]).toEqual([{ date: '2026-10-31', day: 31, label: '31', came: false }, null, null, null, null, null, null]);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
  });

  it('a month starting on Saturday has no lead, and Bangla labels use Bangla digits', () => {
    const weeks = monthGrid('2026-08', [], 'bn'); // 1 Aug 2026 is a Saturday
    expect(weeks[0][0]).toEqual({ date: '2026-08-01', day: 1, label: '১', came: false });
    expect(weeks.flat().find((c) => c?.day === 31)?.label).toBe('৩১');
  });
});

const WORKOUT: Content = {
  kind: 'workout',
  days: [
    { key: 'd1', name: { en: 'Chest', bn: 'বুক' }, items: [{ ref: 'i1', name: { en: 'Bench press' }, sets: 4, reps: '8-10', restSec: 90, videoUrl: 'https://example.com/v' }, { ref: 'i2', name: { en: 'Dips' } }] },
    { key: 'd2', name: { en: 'Rest' }, items: [] },
    { key: 'd3', name: { bn: 'পা' }, items: [{ ref: 'i3', name: { en: 'Squat', bn: 'স্কোয়াট' }, timeSec: 60 }] },
  ],
};
const DIET: Content = {
  kind: 'diet',
  meals: [
    { ref: 'm1', name: { en: 'Breakfast' }, time: '08:00', items: [{ ref: 'f1', name: { en: 'Two eggs' }, portion: '2 pcs', kcal: 140 }] },
    { ref: 'm2', name: { en: 'Lunch' }, items: [{ ref: 'f2', name: { en: 'Rice' } }] },
  ],
  notes: { en: 'Water' },
};

describe('plans: today, the week and ticks (M24 §6.10, FR-65)', () => {
  const workout = { content: WORKOUT, startsOn: '2026-10-20', endsOn: '2026-11-30' };

  it('maps a date to the workout day: (date − starts_on) mod days', () => {
    expect(dayIndexFor(workout, '2026-10-20')).toBe(0);
    expect(dayIndexFor(workout, '2026-10-22')).toBe(2);
    expect(dayIndexFor(workout, '2026-10-23')).toBe(0);
    expect(dayIndexFor(workout, '2026-10-19')).toBeNull(); // before the start
    expect(dayIndexFor(workout, '2026-12-01')).toBeNull(); // after the end
    expect(dayIndexFor({ ...workout, endsOn: null }, '2027-01-01')).toBe(daysBetween('2026-10-20', '2027-01-01') % 3);
    expect(dayIndexFor({ content: DIET, startsOn: '2026-10-20', endsOn: null }, '2026-12-25')).toBe(0);
    expect(dayIndexFor({ content: { kind: 'workout', days: [] }, startsOn: '2026-10-20', endsOn: null }, '2026-10-21')).toBeNull();
  });

  it("uses the API's week when it has the date, else computes it", () => {
    const withWeek = { ...workout, week: [{ date: '2026-10-29', index: 1 }, { date: '2026-10-30', index: null }] };
    expect(planDayFor(withWeek, '2026-10-29')).toBe(1);
    expect(planDayFor(withWeek, '2026-10-30')).toBeNull();
    expect(planDayFor(withWeek, '2026-10-22')).toBe(2);
  });

  it('gives the workout day or every meal of the diet chart', () => {
    expect(groupsOn(workout, '2026-10-20')).toEqual([{ key: 'd1', name: { en: 'Chest', bn: 'বুক' }, refs: ['i1', 'i2'] }]);
    expect(groupsOn(workout, '2026-10-21')).toEqual([{ key: 'd2', name: { en: 'Rest' }, refs: [] }]);
    expect(groupsOn(workout, '2026-10-01')).toBeNull();
    expect(groupsOn({ ...workout, week: [{ date: '2026-10-29', index: 9 }] }, '2026-10-29')).toBeNull(); // a day the content no longer has
    expect(groupsOn({ content: DIET, startsOn: '2026-10-20', endsOn: null }, '2026-10-29')).toEqual([
      { key: 'm1', name: { en: 'Breakfast' }, time: '08:00', refs: ['f1'] },
      { key: 'm2', name: { en: 'Lunch' }, time: null, refs: ['f2'] },
    ]);
  });

  it('the latest tick per item and date wins, whatever order the log comes in', () => {
    const ticks = latestTicks([
      { localDate: '2026-10-29', itemRef: 'i1', done: false, note: null, createdAt: '2026-10-29T03:00:00Z' },
      { localDate: '2026-10-29', itemRef: 'i1', done: true, note: 'easy', createdAt: '2026-10-29T05:00:00Z' },
      { localDate: '2026-10-29', itemRef: 'i1', done: false, note: 'old', createdAt: '2026-10-29T04:00:00Z' },
      { localDate: '2026-10-28', itemRef: 'i1', done: true, note: null, createdAt: '2026-10-28T05:00:00Z' },
      { localDate: '2026-10-29', itemRef: 'i2', done: true, note: null },
      { localDate: '2026-10-29', itemRef: 'i2', done: false, note: null },
    ]);
    expect(ticks.get(tickKey('2026-10-29', 'i1'))).toEqual({ done: true, note: 'easy' });
    expect(ticks.get(tickKey('2026-10-28', 'i1'))).toEqual({ done: true, note: null });
    expect(ticks.get(tickKey('2026-10-29', 'i2'))).toEqual({ done: true, note: null }); // same time: the first (newest) stays
    expect(progressOn(['i1', 'i2', 'i3'], ticks, '2026-10-29')).toEqual({ done: 2, total: 3 });
    expect(progressOn([], ticks, '2026-10-29')).toEqual({ done: 0, total: 0 });
  });

  it("today's workout first, then today's meals, then the rest, read-only last", () => {
    const items = [
      { id: 'a', kind: 'diet' as const, todayIndex: 0, readOnly: true },
      { id: 'b', kind: 'diet' as const, todayIndex: 0, readOnly: false },
      { id: 'c', kind: 'workout' as const, todayIndex: null, readOnly: false },
      { id: 'd', kind: 'workout' as const, todayIndex: 2, readOnly: false },
    ];
    expect(todayFirst(items).map((i) => i.id)).toEqual(['d', 'b', 'a', 'c']);
  });

  it('the days I can tick: today and the API’s days back, capped for the picker', () => {
    expect(logDays('2026-10-29', 2)).toEqual(['2026-10-29', '2026-10-28', '2026-10-27']);
    expect(logDays('2026-10-29', 0)).toEqual(['2026-10-29']);
    expect(logDays('2026-10-29', 30)).toHaveLength(8);
    expect(logDays('2026-10-29', -3)).toEqual(['2026-10-29']);
    expect(canLog('2026-10-29', '2026-10-29', 7, false)).toBe(true);
    expect(canLog('2026-10-22', '2026-10-29', 7, false)).toBe(true);
    expect(canLog('2026-10-21', '2026-10-29', 7, false)).toBe(false); // 8 days back with 7 set
    expect(canLog('2026-10-30', '2026-10-29', 7, false)).toBe(false); // the future
    expect(canLog('2026-10-29', '2026-10-29', 7, true)).toBe(false); // ended plan
  });

  it('names, items, durations and video links', () => {
    expect(textOf({ en: 'Chest', bn: 'বুক' }, 'bn')).toBe('বুক');
    expect(textOf({ en: 'Chest', bn: ' ' }, 'bn')).toBe('Chest');
    expect(textOf({ bn: 'পা' }, 'en')).toBe('পা');
    expect(textOf({}, 'en')).toBe('');
    expect(textOf(null, 'en')).toBe('');
    expect(findItem(WORKOUT, 'i3')).toMatchObject({ name: { en: 'Squat' } });
    expect(findItem(DIET, 'f1')).toMatchObject({ portion: '2 pcs' });
    expect(findItem(DIET, 'zz')).toBeNull();
    expect(splitDuration(90)).toEqual({ m: 1, s: 30 });
    expect(splitDuration(45)).toEqual({ m: 0, s: 45 });
    expect(splitDuration(-5)).toEqual({ m: 0, s: 0 });
    expect(safeVideo('https://youtu.be/x')).toBe('https://youtu.be/x');
    expect(safeVideo('http://youtu.be/x')).toBeNull();
    expect(safeVideo('javascript:alert(1)')).toBeNull();
    expect(safeVideo(null)).toBeNull();
  });
});

describe('check-in QR (M24-FR-50, FR-51)', () => {
  const now = Date.parse('2026-10-29T10:00:00Z');

  it('fetches the next member QR a few seconds before this one expires, never sooner than 1 s', () => {
    expect(qrRefreshIn('2026-10-29T10:00:30Z', now)).toBe(25_000);
    expect(qrRefreshIn('2026-10-29T10:00:30Z', now, 10)).toBe(28_000); // short windows: a 20% margin
    expect(qrRefreshIn('2026-10-29T10:00:30Z', now, 60)).toBe(25_000);
    expect(qrRefreshIn('2026-10-29T10:00:03Z', now)).toBe(1000);
    expect(qrRefreshIn('2026-10-29T09:59:00Z', now)).toBe(1000);
    expect(secondsLeft('2026-10-29T10:00:30Z', now)).toBe(30);
    expect(secondsLeft('2026-10-29T09:00:00Z', now)).toBe(0);
    expect(qrRefreshIn('2000-01-01T00:00:00Z')).toBe(1000); // against the clock
    expect(secondsLeft('2000-01-01T00:00:00Z')).toBe(0);
  });

  it('reads the entrance token from the bare token or the gym link, and nothing else', () => {
    const tok = 'v1.ge.0192f0a4-2222-7aaa-8bbb-123456789abc.58842.AbC_-9';
    expect(entranceTokenFrom(tok)).toBe(tok);
    expect(entranceTokenFrom(`  ${tok}\n`)).toBe(tok);
    expect(entranceTokenFrom(`https://gym.kriraghor.com/me/checkin?e=${encodeURIComponent(tok)}`)).toBe(tok);
    expect(entranceTokenFrom('https://gym.kriraghor.com/me/checkin')).toBeNull();
    expect(entranceTokenFrom('https://gym.kriraghor.com/me/checkin?e=v1.gm.member.1.sig')).toBeNull(); // a member QR
    expect(entranceTokenFrom('v1.ge.gym.notanumber.sig')).toBeNull();
    expect(entranceTokenFrom('GP-7KQ2')).toBeNull();
    expect(entranceTokenFrom('')).toBeNull();
  });

  it('shows my QR only for gyms I am linked to and still a member of', () => {
    const gyms = [
      { id: 1, linked: true, status: 'active' },
      { id: 2, linked: false, status: 'active' },
      { id: 3, linked: true, status: 'left' },
      { id: 4, linked: true, status: 'removed' },
      { id: 5, linked: true, status: 'expired' },
    ];
    expect(linkedGyms(gyms).map((g) => g.id)).toEqual([1, 5]);
  });
});

describe('paying dues (M24-FR-41)', () => {
  it('a due: Pay online, at the counter (with the reason), or nothing to pay', () => {
    expect(duePayState({ outstandingPoisha: 0, onlineFees: true })).toEqual({ kind: 'none' });
    expect(duePayState({ outstandingPoisha: 210000, onlineFees: true, onlineFeesReason: null })).toEqual({ kind: 'online' });
    expect(duePayState({ outstandingPoisha: 210000, onlineFees: false, onlineFeesReason: 'tier' })).toEqual({ kind: 'counter', reason: 'tier' });
    expect(duePayState({ outstandingPoisha: 210000, onlineFees: false, onlineFeesReason: 'role' })).toEqual({ kind: 'counter', reason: 'role' });
    expect(duePayState({ outstandingPoisha: 210000, onlineFees: false, onlineFeesReason: 'restricted' })).toEqual({ kind: 'counter', reason: 'restricted' });
    expect(duePayState({ outstandingPoisha: 210000, onlineFees: false, onlineFeesReason: '' })).toEqual({ kind: 'counter', reason: null });
    expect(duePayState({ outstandingPoisha: 210000, onlineFees: false })).toEqual({ kind: 'counter', reason: null });
  });

  it('a gym card pays online only while my account is linked', () => {
    expect(cardPayState({ outstandingPoisha: 0, onlineFees: true, linked: true })).toEqual({ kind: 'none' });
    expect(cardPayState({ outstandingPoisha: 500, onlineFees: true, linked: true })).toEqual({ kind: 'online' });
    expect(cardPayState({ outstandingPoisha: 500, onlineFees: true, linked: false })).toEqual({ kind: 'counter', reason: null });
    expect(cardPayState({ outstandingPoisha: 500, onlineFees: false, linked: true })).toEqual({ kind: 'counter', reason: null });
  });

  it('the pay screen speaks of the right thing and Done goes back to it', () => {
    expect(payKind('gym_membership_fee')).toBe('gym_fee');
    expect(payKind('gym_package')).toBe('gym_pass');
    expect(payKind('trainer_subscription')).toBe('trainer');
    expect(payKind('esports_entry')).toBe('entry');
    expect(payKind(undefined)).toBe('entry');
    const M = '0192f0a4-1111-7aaa-8bbb-123456789abc';
    expect(payDoneRoute('gym_fee', M)).toBe(`/gym/${M}`);
    expect(payDoneRoute('gym_fee')).toBe('/gym');
    expect(payDoneRoute('gym_fee', null)).toBe('/gym');
    expect(payDoneRoute('gym_pass')).toBe('/gym/passes');
    expect(payDoneRoute('trainer')).toBe('/gym/subscriptions');
    expect(payDoneRoute('entry', M)).toBe('/matches');
  });
});

describe('gym requests (M24-FR-15, FR-16)', () => {
  const now = Date.parse('2026-10-29T10:00:00Z');
  const later = '2026-11-05T10:00:00Z';
  const invite = { id: 'i', direction: 'gym_invite' as const, status: 'pending', canCancel: false, expiresAt: later };
  const join = { id: 'j', direction: 'join_request' as const, status: 'pending', canCancel: true, expiresAt: later };

  it('an invite waits for my answer; my join request can be cancelled', () => {
    expect(requestState(invite, now)).toBe('answer');
    expect(requestState(join, now)).toBe('cancel');
    expect(requestState({ ...join, canCancel: false }, now)).toBe('waiting_gym');
  });

  it('expired by status or by date (before the job flips it), and answered ones are closed', () => {
    expect(requestState({ ...invite, status: 'expired' }, now)).toBe('expired');
    expect(requestState({ ...invite, expiresAt: '2026-10-29T09:59:59Z' }, now)).toBe('expired');
    expect(requestState({ ...invite, status: 'accepted' }, now)).toBe('closed');
    expect(requestState({ ...join, status: 'declined' }, now)).toBe('closed');
    expect(requestState({ ...join, status: 'cancelled' }, now)).toBe('closed');
    expect(requestState({ ...invite, expiresAt: new Date(Date.now() + 86400000).toISOString() })).toBe('answer'); // against the clock: a day from now
  });

  it('the badge counts only invites waiting for me', () => {
    expect(waitingInvites([invite, join, { ...invite, id: 'x', expiresAt: '2026-10-01T00:00:00Z' }, { ...invite, id: 'y', status: 'accepted' }], now)).toBe(1);
    expect(waitingInvites(undefined, now)).toBe(0);
    expect(waitingInvites([])).toBe(0);
  });

  it('pending and expired lists merge once and split into invites, my join requests and expired', () => {
    const stale = { ...invite, id: 's', expiresAt: '2026-10-28T00:00:00Z' };
    const gone = { ...join, id: 'g', status: 'expired' };
    const parts = splitRequests([[invite, join, stale], [stale, gone], undefined], now);
    expect(parts.invites.map((r) => r.id)).toEqual(['i']);
    expect(parts.joins.map((r) => r.id)).toEqual(['j']);
    expect(parts.expired.map((r) => r.id)).toEqual(['s', 'g']);
    expect(splitRequests([]).invites).toEqual([]);
  });
});

describe('classes (M27-FR-48 to FR-50)', () => {
  const now = Date.parse('2026-11-10T06:00:00Z');
  const at = (h: number) => new Date(now + h * 3_600_000).toISOString();
  const s = (over: Partial<Parameters<typeof classAction>[0]> = {}) => ({ status: 'scheduled', startsAt: at(2), spaces: 3, myBooking: null, ...over });

  it('offers a place, the waitlist or my cancel', () => {
    expect(classAction(s(), now)).toBe('book');
    expect(classAction(s({ spaces: 0 }), now)).toBe('waitlist');
    expect(classAction(s({ myBooking: { id: 'b', status: 'booked' } }), now)).toBe('cancel');
    expect(classAction(s({ spaces: 0, myBooking: { id: 'b', status: 'waitlisted' } }), now)).toBe('cancel');
    // A cancelled booking of mine is a free hand again.
    expect(classAction(s({ myBooking: { id: 'b', status: 'cancelled' } }), now)).toBe('book');
  });

  it('offers nothing once the class has started, is cancelled or is done', () => {
    expect(classAction(s({ startsAt: at(0) }), now)).toBe('none');
    expect(classAction(s({ startsAt: at(-1), myBooking: { id: 'b', status: 'booked' } }), now)).toBe('none');
    expect(classAction(s({ status: 'cancelled' }), now)).toBe('none');
    expect(classAction(s({ status: 'done' }), now)).toBe('none');
  });

  it('groups sessions by Dhaka day, in time order', () => {
    const items = [
      { id: 'c', localDate: '2026-11-12', startsAt: '2026-11-12T01:00:00Z' },
      { id: 'b', localDate: '2026-11-11', startsAt: '2026-11-11T12:30:00Z' },
      { id: 'a', localDate: '2026-11-11', startsAt: '2026-11-11T01:00:00Z' },
    ];
    expect(byDay(items).map((d) => [d.date, d.items.map((x) => x.id)])).toEqual([
      ['2026-11-11', ['a', 'b']],
      ['2026-11-12', ['c']],
    ]);
    expect(byDay([])).toEqual([]);
  });
});

describe('free trial visits (M24 §17)', () => {
  const day = [{ openTime: '05:30', closeTime: '07:00' }];

  it('offers every half hour inside the opening windows, not the closing time', () => {
    expect(visitTimes(day)).toEqual(['05:30', '06:00', '06:30']);
    expect(visitTimes([{ openTime: '06:10', closeTime: '07:10' }])).toEqual(['06:30', '07:00']);
    expect(visitTimes([...day, { openTime: '06:30', closeTime: '07:30' }])).toEqual(['05:30', '06:00', '06:30', '07:00']);
    expect(visitTimes(day, { step: 60 })).toEqual(['06:00']);
  });

  it('on today offers only times still ahead, and ignores a window it cannot read', () => {
    expect(visitTimes(day, { isToday: true, nowMinute: 6 * 60 })).toEqual(['06:30']);
    expect(visitTimes(day, { isToday: true, nowMinute: 7 * 60 })).toEqual([]);
    expect(visitTimes(day, { isToday: false, nowMinute: 7 * 60 })).toHaveLength(3);
    expect(visitTimes([null, { openTime: '05:30' }, {}])).toEqual([]);
  });

  it('keeps the days with a place and a time left', () => {
    const days = [
      { date: '2026-11-10', windows: day, placesLeft: 2 }, // today, closed by now
      { date: '2026-11-11', windows: day, placesLeft: 0 }, // full
      { date: '2026-11-12', windows: [], placesLeft: 3 }, // closed that day
      { date: '2026-11-13', windows: day, placesLeft: 1 },
    ];
    expect(bookableDays(days, { today: '2026-11-10', nowMinute: 20 * 60 }).map((d) => d.date)).toEqual(['2026-11-13']);
    expect(bookableDays(days, { today: '2026-11-10', nowMinute: 5 * 60 }).map((d) => d.date)).toEqual(['2026-11-10', '2026-11-13']);
  });

  it('puts booked visits with a QR first, soonest first, and the rest after', () => {
    const v = (id: string, status: string, date: string, arriveAt: string, token: string | null = null) => ({ id, status, date, arriveAt, token });
    const items = [v('late', 'booked', '2026-11-12', '07:30', 't2'), v('missed', 'no_show', '2026-11-01', '18:00'), v('soon', 'booked', '2026-11-11', '18:00', 't1'), v('old', 'cancelled', '2026-10-20', '09:00')];
    const { coming, past } = splitVisits(items);
    expect(coming.map((x) => x.id)).toEqual(['soon', 'late']);
    expect(past.map((x) => x.id)).toEqual(['missed', 'old']);
    // A booked visit of a past day has no token any more: it is history.
    expect(splitVisits([v('stale', 'booked', '2026-11-01', '09:00')]).past).toHaveLength(1);
  });

  it('reads the code out in two groups', () => {
    expect(codeGroups('7KQ2ZB')).toBe('7KQ 2ZB');
  });
});

describe('clock times and my work (M27-FR-73)', () => {
  it('reads the Dhaka minute of the day whatever the phone zone', () => {
    expect(dhakaMinuteNow(Date.parse('2026-11-10T00:00:00Z'))).toBe(6 * 60);
    expect(dhakaMinuteNow(Date.parse('2026-11-10T18:15:00Z'))).toBe(15);
    expect(dhakaMinuteNow(new Date('2026-11-10T17:59:00Z'))).toBe(23 * 60 + 59);
  });

  it('writes a clock time like an instant', () => {
    expect(clockTime('18:30')).toBe('6:30 pm');
    expect(clockTime('05:30', 'bn')).toBe('সকাল ৫:৩০');
    expect(clockTime('00:00')).toBe('12:00 am');
  });

  it('splits minutes worked into hours and minutes', () => {
    expect(hoursMinutes(135)).toEqual({ h: 2, m: 15 });
    expect(hoursMinutes(0)).toEqual({ h: 0, m: 0 });
    expect(hoursMinutes(-5)).toEqual({ h: 0, m: 0 });
  });

  it('lists only the gyms where I am staff with clock.in', () => {
    const gyms = [
      { id: 'own', role: 'owner', permissions: null },
      { id: 'desk', role: 'staff', permissions: ['attendance.mark', 'clock.in'] },
      { id: 'noclock', role: 'staff', permissions: ['attendance.mark'] },
      { id: 'bare', role: 'staff' },
    ];
    expect(clockWorkplaces(gyms).map((g) => g.id)).toEqual(['desk']);
    expect(clockWorkplaces(undefined)).toEqual([]);
  });
});
