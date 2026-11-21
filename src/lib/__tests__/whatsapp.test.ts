import { classMessage, fill, gymMessage, localMobile, needsReconsent, numberToSave, packageMessage, parseBdMobile, waUrl } from '../whatsapp';

// M24-FR-158 (chat buttons on a gym's page) and M24-FR-159 (my WhatsApp number and consents): step 1, the member side.
/** The text WhatsApp reads back from the link. */
const decoded = (url: string | null) => new URL(url!).searchParams.get('text') ?? '';

describe('Bangladesh mobile numbers', () => {
  it.each([
    ['01712345678', '+8801712345678'],
    ['8801712345678', '+8801712345678'],
    ['+8801712345678', '+8801712345678'],
    ['+880 1712-345678', '+8801712345678'],
    [' 01312345678 ', '+8801312345678'],
    ['০১৯১২৩৪৫৬৭৮', '+8801912345678'],
  ])('reads %p as %p', (input, e164) => {
    expect(parseBdMobile(input)).toBe(e164);
  });

  it.each(['', '0171234567', '017123456789', '01212345678', '01012345678', '+447911123456', 'abc', '02-9876543'])('refuses %p', (input) => {
    expect(parseBdMobile(input)).toBeNull();
  });

  it('refuses nothing at all', () => {
    expect(parseBdMobile(null)).toBeNull();
    expect(parseBdMobile(undefined)).toBeNull();
  });

  it('shows a number the local way, 01XXXXXXXXX, or empty', () => {
    expect(localMobile('+8801712345678')).toBe('01712345678');
    expect(localMobile('8801812345678')).toBe('01812345678');
    expect(localMobile(null)).toBe('');
    expect(localMobile('12345')).toBe('');
  });
});

describe('waUrl', () => {
  it('builds a wa.me link with the number without the plus', () => {
    expect(waUrl('+8801712345678')).toBe('https://wa.me/8801712345678');
    expect(waUrl('01712345678', '  ')).toBe('https://wa.me/8801712345678');
  });

  it('URL-encodes the text: spaces, quotes, ampersands, question marks, ৳ and Bangla', () => {
    const text = 'Hi & "hello"? ৳1,500 হ্যালো #1 50%';
    const url = waUrl('01712345678', text);
    expect(url).toBe(`https://wa.me/8801712345678?text=${encodeURIComponent(text)}`);
    const query = url!.split('?text=')[1];
    expect(query).not.toMatch(/[ "&?#]/);
    expect(url!.split('?')).toHaveLength(2);
    expect(decoded(url)).toBe(text);
  });

  it('is null for a number that is not a Bangladesh mobile', () => {
    expect(waUrl(null, 'x')).toBeNull();
    expect(waUrl(undefined)).toBeNull();
    expect(waUrl('', 'x')).toBeNull();
    expect(waUrl('+447911123456', 'x')).toBeNull();
    expect(waUrl('01212345678', 'x')).toBeNull();
  });
});

describe('messages', () => {
  it('fills {{name}} templates and leaves out a name with no value', () => {
    expect(fill('Hi {{gym}}, {{missing}}done', { gym: 'Iron' })).toBe('Hi Iron, done');
  });

  it('the gym page: a hello to the gym, in English and Bangla', () => {
    expect(gymMessage('Iron House')).toBe('Hello Iron House, I found you on Kriraghor and have a question.');
    expect(gymMessage('Iron House', 'bn')).toBe('হ্যালো Iron House, ক্রীড়াঘরে আপনাদের দেখেছি, একটা বিষয় জানতে চাই।');
  });

  it('a package: title, price with the app money format and days, Bangla digits in Bangla', () => {
    const p = { gym: 'Iron House', title: '3 months', price: 450000, days: 90 };
    expect(packageMessage(p)).toBe('Hello Iron House, I saw "3 months" (৳4,500, 90 days) on Kriraghor. Can you tell me more?');
    expect(packageMessage(p, 'bn')).toBe('হ্যালো Iron House, ক্রীড়াঘরে "3 months" (৳৪,৫০০, ৯০ দিন) দেখেছি। আরেকটু জানাবেন?');
    expect(packageMessage({ ...p, price: 1250050 })).toContain('৳12,500.50');
  });

  it('a class: name, day and start time in Dhaka time', () => {
    const c = { gym: 'Iron House', name: 'Zumba', localDate: '2026-11-22', startsAt: '2026-11-22T12:30:00.000Z' };
    expect(classMessage(c)).toBe('Hello Iron House, I saw the Zumba class on Sun 22 Nov at 6:30 pm on Kriraghor. Can you tell me more?');
    expect(classMessage(c, 'bn')).toBe('হ্যালো Iron House, ক্রীড়াঘরে রবি ২২ নভে সন্ধ্যা ৬:৩০-এর Zumba ক্লাসটি দেখেছি। আরেকটু জানাবেন?');
  });

  it('every message survives the wa.me round trip unchanged', () => {
    const text = packageMessage({ gym: 'Fit & Strong "BD"', title: 'Ladies? 1 month', price: 150000, days: 30 }, 'bn');
    expect(decoded(waUrl('01712345678', text))).toBe(text);
  });
});

describe('the number to save (M24-FR-159)', () => {
  const phone = '+8801712345678';

  it('empty means "use my phone": null', () => {
    expect(numberToSave('', phone)).toEqual({ ok: true, number: null });
    expect(numberToSave('   ', null)).toEqual({ ok: true, number: null });
  });

  it('my phone typed again is saved as null, so it follows the phone', () => {
    expect(numberToSave('01712345678', phone)).toEqual({ ok: true, number: null });
    expect(numberToSave('+880 1712 345678', phone)).toEqual({ ok: true, number: null });
  });

  it('another number is saved in E.164', () => {
    expect(numberToSave('01812345678', phone)).toEqual({ ok: true, number: '+8801812345678' });
    expect(numberToSave('01812345678', null)).toEqual({ ok: true, number: '+8801812345678' });
  });

  it('something that is not a Bangladesh mobile is refused', () => {
    expect(numberToSave('0181234', phone)).toEqual({ ok: false });
    expect(numberToSave('01212345678', phone)).toEqual({ ok: false });
  });
});

describe('asking again after the consent text changed', () => {
  it.each([
    [null, 2, false],
    [1, 2, true],
    [2, 2, false],
    [3, 2, false],
  ])('agreed to version %p, current %p: ask again %p', (consentVersion, currentVersion, ask) => {
    expect(needsReconsent({ consentVersion, currentVersion })).toBe(ask);
  });
});
