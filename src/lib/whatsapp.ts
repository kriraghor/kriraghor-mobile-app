import { bn } from '../i18n/bn';
import { en } from '../i18n/en';
import { normalizePhone } from './auth-flow';
import { count, money, type Lang } from './format';
import { dateOnly, timeOnly } from './gym';

/**
 * WhatsApp chat buttons for gyms (M24-FR-158, step 1: the member side). The gym page's number opens a
 * wa.me chat with a message already written for what the member picked (the gym, a package, a class);
 * nothing is sent until the member taps send in WhatsApp. Sending from the gym through the WhatsApp
 * API is a later step and switched off. Pure, so it is unit-tested without a phone. The message texts
 * live in i18n (`gymWhatsapp.msg`), in English and Bangla, with Bangla digits in Bangla.
 */

const BN_ZERO = '০'.charCodeAt(0);
/** Bangla keyboards type ০–৯: read them as 0–9. */
const asciiDigits = (s: string) => s.replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - BN_ZERO));

/**
 * A Bangladesh mobile in any form people type (01…, 8801…, +880 1…, with spaces or dashes, Bangla
 * digits) as E.164 `+8801XXXXXXXXX`, or null. The local form must match `^01[3-9]\d{8}$`.
 */
export function parseBdMobile(input: string | null | undefined): string | null {
  if (!input) return null;
  return normalizePhone(asciiDigits(input.trim()));
}

/** `+8801712345678` → `01712345678`, the way people in Bangladesh write a number; '' when not a BD mobile. */
export function localMobile(input: string | null | undefined): string {
  const e164 = parseBdMobile(input);
  return e164 ? `0${e164.slice(4)}` : '';
}

/** `https://wa.me/8801…?text=…` (the text URL-encoded), or null when the number is not a Bangladesh mobile. */
export function waUrl(number: string | null | undefined, text?: string | null): string | null {
  const e164 = parseBdMobile(number);
  if (!e164) return null;
  const base = `https://wa.me/${e164.slice(1)}`;
  const body = text?.trim();
  return body ? `${base}?text=${encodeURIComponent(body)}` : base;
}

const texts = (lang: Lang) => (lang === 'bn' ? bn : en).gymWhatsapp.msg;
/** Puts the values into a {{name}} template, as i18next does; a name with no value is left out. */
export const fill = (template: string, vars: Record<string, string>) => template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? '');

/** The gym page's button: a hello and a question. */
export function gymMessage(gym: string, lang: Lang = 'en'): string {
  return fill(texts(lang).gym, { gym });
}

/** "Ask on WhatsApp" on a package: its title, price (৳, Bangla digits in Bangla) and how many days it runs. */
export function packageMessage(p: { gym: string; title: string; price: number; days: number }, lang: Lang = 'en'): string {
  return fill(texts(lang).package, { gym: p.gym, title: p.title, price: money(p.price, lang), days: count(p.days, lang) });
}

/** "Ask on WhatsApp" on a timetable class: its name, day and start time (Dhaka time). */
export function classMessage(c: { gym: string; name: string; localDate: string; startsAt: string }, lang: Lang = 'en'): string {
  return fill(texts(lang).class, { gym: c.gym, name: c.name, day: dateOnly(c.localDate, lang, { weekday: true, year: false }), time: timeOnly(c.startsAt, lang) });
}

/**
 * The number to save for my WhatsApp at a gym: null means "use my phone in the gym's record", so a
 * number equal to that phone is saved as null and follows the phone if the gym changes it. Empty is
 * also null. `invalid` when something was typed that is not a Bangladesh mobile.
 */
export function numberToSave(input: string, phone: string | null): { ok: true; number: string | null } | { ok: false } {
  if (!input.trim()) return { ok: true, number: null };
  const e164 = parseBdMobile(input);
  if (!e164) return { ok: false };
  return { ok: true, number: e164 === parseBdMobile(phone) ? null : e164 };
}

/** A member who agreed to an older consent text is asked to check and save again. */
export const needsReconsent = (s: { consentVersion: number | null; currentVersion: number }) => s.consentVersion !== null && s.consentVersion < s.currentVersion;
