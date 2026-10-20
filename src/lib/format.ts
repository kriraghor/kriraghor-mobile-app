/**
 * Numbers, money and times as people in Bangladesh read them. Money arrives from the API as integer
 * poisha (100 poisha = ৳1) and is never handled as a float sum. Times are shown in Asia/Dhaka
 * whatever the phone's zone. Bangla uses Bangla digits.
 */
export type Lang = 'en' | 'bn';

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
export const bnDigits = (s: string) => s.replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
const digits = (s: string, lang: Lang) => (lang === 'bn' ? bnDigits(s) : s);

/** 1,23,456 (South Asian grouping, as on receipts in Bangladesh). */
function group(whole: number): string {
  const s = String(whole);
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

/** ৳1,500 or ৳১,৫০০; poisha shown only when there are some (৳12.50). */
export function money(poisha: number, lang: Lang = 'en'): string {
  if (!Number.isInteger(poisha)) throw new Error('money() takes integer poisha');
  const sign = poisha < 0 ? '−' : '';
  const abs = Math.abs(poisha);
  const whole = Math.floor(abs / 100);
  const part = abs % 100;
  const text = `${group(whole)}${part ? `.${String(part).padStart(2, '0')}` : ''}`;
  return `${sign}৳${digits(text, lang)}`;
}

export const count = (n: number, lang: Lang = 'en') => digits(group(n), lang);

const DHAKA_MS = 6 * 3600 * 1000; // Asia/Dhaka has no daylight saving
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BN_MONTHS = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রি', 'মে', 'জুন', 'জুলাই', 'আগ', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];
const EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const BN_DAYS = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহস্পতি', 'শুক্র', 'শনি'];

/**
 * "Wed 22 Oct, 8:30 pm" / "বুধ ২২ অক্টো, রাত ৮:৩০", in Dhaka time. Written by hand rather than with
 * Intl so it reads the same on every phone (Hermes builds differ in their Bangla locale data).
 */
export function dateTime(iso: string | Date, lang: Lang = 'en'): string {
  const d = new Date(new Date(iso).getTime() + DHAKA_MS);
  const day = d.getUTCDate();
  const month = d.getUTCMonth();
  const weekday = d.getUTCDay();
  const h24 = d.getUTCHours();
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  if (lang === 'bn') {
    const part = h24 < 4 ? 'রাত' : h24 < 12 ? 'সকাল' : h24 < 15 ? 'দুপুর' : h24 < 18 ? 'বিকেল' : h24 < 20 ? 'সন্ধ্যা' : 'রাত';
    return `${BN_DAYS[weekday]} ${bnDigits(String(day))} ${BN_MONTHS[month]}, ${part} ${bnDigits(`${h12}:${min}`)}`;
  }
  return `${EN_DAYS[weekday]} ${day} ${EN_MONTHS[month]}, ${h12}:${min} ${h24 < 12 ? 'am' : 'pm'}`;
}

/** Time left until `iso`: "2d 4h", "3h 05m", "12:08" (mm:ss under an hour), or null when it has passed. */
export function countdown(iso: string | Date, now: number = Date.now(), lang: Lang = 'en'): string | null {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const u = lang === 'bn' ? { d: 'দি', h: 'ঘ' } : { d: 'd', h: 'h' };
  const text = days > 0 ? `${days}${u.d} ${hours}${u.h}` : hours > 0 ? `${hours}${u.h} ${String(mins).padStart(2, '0')}m` : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return digits(lang === 'bn' ? text.replace(/m$/, 'মি') : text, lang);
}
