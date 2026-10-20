import { bnDigits, count, countdown, dateTime, money } from '../format';

describe('money (integer poisha, never floats)', () => {
  it('formats taka with South Asian grouping, in English and Bangla digits', () => {
    expect(money(150000)).toBe('৳1,500');
    expect(money(150000, 'bn')).toBe('৳১,৫০০');
    expect(money(12345600)).toBe('৳1,23,456');
    expect(money(0)).toBe('৳0');
    expect(money(99)).toBe('৳0.99');
  });

  it('shows poisha only when there are some, and a sign for negatives', () => {
    expect(money(1250)).toBe('৳12.50');
    expect(money(1205)).toBe('৳12.05');
    expect(money(-50000)).toBe('−৳500');
  });

  it('refuses fractions of a poisha', () => {
    expect(() => money(10.5)).toThrow('integer poisha');
  });

  it('counts and digits', () => {
    expect(count(48)).toBe('48');
    expect(count(1200, 'bn')).toBe('১,২০০');
    expect(bnDigits('Room 0123')).toBe('Room ০১২৩');
  });
});

describe('dates in Dhaka time', () => {
  it('shows the Dhaka wall clock whatever the phone zone (UTC 14:30 is 8:30 pm in Dhaka)', () => {
    expect(dateTime('2026-10-22T14:30:00Z')).toBe('Thu 22 Oct, 8:30 pm');
    expect(dateTime('2026-10-22T14:30:00Z', 'bn')).toBe('বৃহস্পতি ২২ অক্টো, রাত ৮:৩০');
  });

  it('crosses midnight into the next Dhaka day, and handles noon and midnight', () => {
    expect(dateTime('2026-10-22T19:00:00Z')).toBe('Fri 23 Oct, 1:00 am');
    expect(dateTime('2026-10-22T06:00:00Z')).toBe('Thu 22 Oct, 12:00 pm');
    expect(dateTime('2026-10-21T18:00:00Z')).toBe('Thu 22 Oct, 12:00 am');
  });

  it('names the part of the day in Bangla', () => {
    expect(dateTime('2026-10-22T03:00:00Z', 'bn')).toContain('সকাল ৯:০০');
    expect(dateTime('2026-10-22T07:00:00Z', 'bn')).toContain('দুপুর ১:০০');
    expect(dateTime('2026-10-22T10:00:00Z', 'bn')).toContain('বিকেল ৪:০০');
    expect(dateTime('2026-10-22T12:30:00Z', 'bn')).toContain('সন্ধ্যা ৬:৩০');
    expect(dateTime('2026-10-21T20:00:00Z', 'bn')).toContain('রাত ২:০০');
  });
});

describe('countdown', () => {
  const now = Date.parse('2026-10-22T12:00:00Z');
  it('days, hours, then minutes and seconds', () => {
    expect(countdown('2026-10-24T16:00:00Z', now)).toBe('2d 4h');
    expect(countdown('2026-10-22T15:05:00Z', now)).toBe('3h 05m');
    expect(countdown('2026-10-22T12:12:08Z', now)).toBe('12:08');
    expect(countdown('2026-10-22T15:05:00Z', now, 'bn')).toBe('৩ঘ ০৫মি');
  });
  it('is null once the time has passed', () => {
    expect(countdown('2026-10-22T12:00:00Z', now)).toBeNull();
    expect(countdown('2026-10-22T11:00:00Z', now)).toBeNull();
  });
});
