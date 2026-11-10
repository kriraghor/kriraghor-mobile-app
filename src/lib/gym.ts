import { BN_DAYS, BN_MONTHS, bnDigits, DHAKA_MS, EN_DAYS, EN_MONTHS, type Lang } from './format';

/**
 * Pure helpers for the member gym screens (M24 §4.5), mirroring the web member area (apps/gym
 * lib/plans.ts and lib/gym-manage.ts) so the app and gym.kriraghor.com read the same data the same
 * way. No React and no network here: everything is unit-tested (src/lib/__tests__/gym.test.ts).
 * Dates are Dhaka calendar dates (YYYY-MM-DD); business days follow Asia/Dhaka (CLAUDE.md).
 */

// ---------------------------------------------------------------- Dhaka dates
const DAY_MS = 86_400_000;

/** Today's date in Dhaka, whatever the phone's zone. */
export const dhakaToday = (now: number | Date = Date.now()) => new Date(new Date(now).getTime() + DHAKA_MS).toISOString().slice(0, 10);
export const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
export const monthOf = (date: string) => date.slice(0, 7);
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

/** A calendar date ("2026-10-22") or an instant (ISO with a time, read in Dhaka) as its Dhaka date. */
function dhakaDate(value: string): Date {
  return /T/.test(value) ? new Date(Date.parse(value) + DHAKA_MS) : new Date(`${value.slice(0, 10)}T00:00:00Z`);
}

const digitsFor = (s: string, lang: Lang) => (lang === 'bn' ? bnDigits(s) : s);

/** "22 Oct 2026" / "২২ অক্টো ২০২৬"; with `weekday`, "Wed 22 Oct 2026"; `year: false` drops the year. */
export function dateOnly(value: string, lang: Lang = 'en', opts: { weekday?: boolean; year?: boolean } = {}): string {
  const d = dhakaDate(value);
  const months = lang === 'bn' ? BN_MONTHS : EN_MONTHS;
  const days = lang === 'bn' ? BN_DAYS : EN_DAYS;
  const parts = [opts.weekday ? days[d.getUTCDay()] : null, digitsFor(String(d.getUTCDate()), lang), months[d.getUTCMonth()], opts.year === false ? null : digitsFor(String(d.getUTCFullYear()), lang)];
  return parts.filter(Boolean).join(' ');
}

/** "8:30 am" / "সকাল ৮:৩০" for an instant, in Dhaka time. */
export function timeOnly(iso: string, lang: Lang = 'en'): string {
  const d = dhakaDate(iso);
  const h24 = d.getUTCHours();
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  if (lang === 'bn') {
    const part = h24 < 4 ? 'রাত' : h24 < 12 ? 'সকাল' : h24 < 15 ? 'দুপুর' : h24 < 18 ? 'বিকেল' : h24 < 20 ? 'সন্ধ্যা' : 'রাত';
    return `${part} ${bnDigits(`${h12}:${min}`)}`;
  }
  return `${h12}:${min} ${h24 < 12 ? 'am' : 'pm'}`;
}

/** A day's short weekday name ("Sat" / "শনি"). */
export const weekdayOf = (date: string, lang: Lang = 'en') => (lang === 'bn' ? BN_DAYS : EN_DAYS)[dhakaDate(date).getUTCDay()];

const EN_MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const BN_MONTHS_LONG = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];

/** "October 2026" / "অক্টোবর ২০২৬" for "2026-10". */
export function monthTitle(month: string, lang: Lang = 'en'): string {
  const [y, m] = month.split('-').map(Number);
  return `${(lang === 'bn' ? BN_MONTHS_LONG : EN_MONTHS_LONG)[m - 1]} ${digitsFor(String(y), lang)}`;
}

/** The calendar's column heads, Saturday first (the Bangladesh week). */
export const weekHeads = (lang: Lang = 'en') => [6, 0, 1, 2, 3, 4, 5].map((i) => (lang === 'bn' ? BN_DAYS : EN_DAYS)[i]);

export type CalendarCell = { date: string; day: number; label: string; came: boolean } | null;

/** A month as weeks for the check-in calendar, Saturday first; null pads the first and last week. */
export function monthGrid(month: string, came: readonly string[], lang: Lang = 'en'): CalendarCell[][] {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const seen = new Set(came);
  const lead = (first.getUTCDay() + 1) % 7; // Saturday → 0
  const cells: CalendarCell[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d += 1) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    cells.push({ date, day: d, label: digitsFor(String(d), lang), came: seen.has(date) });
  }
  while (cells.length % 7) cells.push(null);
  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// ---------------------------------------------------------------- plans (M24 §6.10, M24-FR-65)
export type Bilingual = { en?: string | null; bn?: string | null };
type Named = { name: Bilingual };
type WorkoutItem = Named & { ref: string; sets?: number | null; reps?: string | null; timeSec?: number | null; restSec?: number | null; weightNote?: string | null; note?: string | null; videoUrl?: string | null };
type FoodItem = Named & { ref: string; portion?: string | null; kcal?: number | null; proteinG?: number | null; note?: string | null };
export type Content =
  | { kind: 'workout'; days: (Named & { key: string; items: WorkoutItem[] })[] }
  | { kind: 'diet'; meals: (Named & { ref: string; time?: string | null; items: FoodItem[] })[]; notes?: Bilingual | null };
export type PlanLike = { content: Content; startsOn: string; endsOn: string | null; week?: { date: string; index: number | null }[] };

/** The text in the reader's language, else the other one (plans are written in English, Bangla or both). */
export function textOf(name: Bilingual | null | undefined, lang: Lang): string {
  if (!name) return '';
  const first = lang === 'bn' ? name.bn : name.en;
  const second = lang === 'bn' ? name.en : name.bn;
  return (first?.trim() || second?.trim() || '').trim();
}

export const tickKey = (date: string, ref: string) => `${date}|${ref}`;
export type Tick = { done: boolean; note: string | null };

/** The latest tick per item and date wins (the log is append-only); ties keep the API's order (newest first). */
export function latestTicks(logs: readonly { localDate: string; itemRef: string; done: boolean; note: string | null; createdAt?: string }[]): Map<string, Tick> {
  const out = new Map<string, Tick & { at: number }>();
  for (const l of logs) {
    const k = tickKey(l.localDate, l.itemRef);
    const at = l.createdAt ? Date.parse(l.createdAt) : 0;
    const seen = out.get(k);
    if (!seen || at > seen.at) out.set(k, { done: l.done, note: l.note, at });
  }
  return new Map([...out].map(([k, v]) => [k, { done: v.done, note: v.note }]));
}

/** The workout day for a date: days[(date − starts_on) mod days.length]; a diet chart is day 0 every day; null outside the plan's dates. */
export function dayIndexFor(item: PlanLike, date: string): number | null {
  const days = item.content.kind === 'workout' ? item.content.days.length : 1;
  if (!days || date < item.startsOn || (item.endsOn && date > item.endsOn)) return null;
  return daysBetween(item.startsOn, date) % days;
}

/** The API's day for a date when it sent one (its `week`), else the same mapping computed here. */
export function planDayFor(item: PlanLike, date: string): number | null {
  const fromApi = item.week?.find((w) => w.date === date);
  return fromApi ? fromApi.index : dayIndexFor(item, date);
}

export type Group = { key: string; name: Bilingual; time?: string | null; refs: string[] };

/** What to do on a date: the workout day, or every meal of the diet chart; null when nothing is planned. */
export function groupsOn(item: PlanLike, date: string): Group[] | null {
  const index = planDayFor(item, date);
  if (index === null) return null;
  if (item.content.kind === 'diet') return item.content.meals.map((m) => ({ key: m.ref, name: m.name, time: m.time ?? null, refs: m.items.map((i) => i.ref) }));
  const day = item.content.days[index];
  return day ? [{ key: day.key, name: day.name, refs: day.items.map((i) => i.ref) }] : null;
}

export function progressOn(refs: readonly string[], ticks: ReadonlyMap<string, { done: boolean }>, date: string): { done: number; total: number } {
  return { done: refs.filter((r) => ticks.get(tickKey(date, r))?.done).length, total: refs.length };
}

/** Today's workout first, then today's meals, then the rest (read-only plans last), otherwise in the API's order. */
export function todayFirst<T extends { kind: 'workout' | 'diet'; todayIndex: number | null; readOnly: boolean }>(items: readonly T[]): T[] {
  const rank = (x: T) => (!x.readOnly && x.todayIndex !== null ? (x.kind === 'workout' ? 0 : 1) : 2);
  return items
    .map((x, i) => ({ x, i }))
    .sort((a, b) => rank(a.x) - rank(b.x) || a.i - b.i)
    .map((v) => v.x);
}

/** The days a member can still tick: today and up to `logBackDays` back (capped for the day picker), newest first. */
export function logDays(today: string, logBackDays: number, cap = 7): string[] {
  const back = Math.max(0, Math.min(Math.floor(logBackDays), cap));
  return Array.from({ length: back + 1 }, (_, i) => addDays(today, -i));
}

/** Whether a tick for `date` is allowed (M24-FR-65): not read-only, not in the future, within the window. */
export function canLog(date: string, today: string, logBackDays: number, readOnly: boolean): boolean {
  if (readOnly || date > today) return false;
  return daysBetween(date, today) <= logBackDays;
}

/** One exercise or food by its ref (the ref stays the same across plan versions). */
export function findItem(content: Content, ref: string): WorkoutItem | FoodItem | null {
  const items: (WorkoutItem | FoodItem)[] = content.kind === 'workout' ? content.days.flatMap((d) => d.items) : content.meals.flatMap((m) => m.items);
  return items.find((i) => i.ref === ref) ?? null;
}

/** 90 → { m: 1, s: 30 }. */
export const splitDuration = (sec: number) => ({ m: Math.floor(Math.max(0, sec) / 60), s: Math.max(0, sec) % 60 });

/** A video link is opened only when it is https (the API refuses anything else; this is a second guard). */
export const safeVideo = (url: string | null | undefined) => (url && /^https:\/\/[^\s]+$/i.test(url) ? url : null);

// ---------------------------------------------------------------- check-in QR (M24-FR-50, FR-51)
/** When to fetch the next member QR: a little before this one expires (never sooner than 1 s). */
export function qrRefreshIn(expiresAt: string, now: number = Date.now(), seconds?: number): number {
  const margin = seconds ? Math.min(5000, seconds * 200) : 5000;
  return Math.max(1000, Date.parse(expiresAt) - now - margin);
}

export const secondsLeft = (expiresAt: string, now: number = Date.now()) => Math.max(0, Math.round((Date.parse(expiresAt) - now) / 1000));

/** The entrance QR holds a link (…/me/checkin?e=<token>) or the bare token v1.ge.<gymId>.<window>.<sig>; anything else is not ours. */
export function entranceTokenFrom(text: string): string | null {
  const v = text.trim();
  const ok = (t: string | null) => (t && /^v1\.ge\.[^.\s]+\.\d{1,12}\.[^.\s]+$/.test(t) ? t : null);
  if (ok(v)) return v;
  try {
    return ok(new URL(v).searchParams.get('e'));
  } catch {
    return null;
  }
}

/** Gyms that can show my QR and take my scan: linked, and I have not left or been removed. */
export const linkedGyms = <T extends { linked: boolean; status: string }>(items: readonly T[]) => items.filter((m) => m.linked && m.status !== 'left' && m.status !== 'removed');

// ---------------------------------------------------------------- dues (M24-FR-41)
export type OfflineReason = 'role' | 'tier' | 'restricted' | null;
export type PayState = { kind: 'none' } | { kind: 'online' } | { kind: 'counter'; reason: OfflineReason };

/** A due: Pay in the app when the gym takes fees online, else "Pay at the counter" with the reason when the API gives one. */
export function duePayState(d: { outstandingPoisha: number; onlineFees: boolean; onlineFeesReason?: string | null }): PayState {
  if (d.outstandingPoisha <= 0) return { kind: 'none' };
  if (d.onlineFees) return { kind: 'online' };
  const r = d.onlineFeesReason;
  return { kind: 'counter', reason: r === 'role' || r === 'tier' || r === 'restricted' ? r : null };
}

/** A gym card: online only while my account is linked to the member (an unlinked past gym is history). */
export const cardPayState = (m: { outstandingPoisha: number; onlineFees: boolean; linked: boolean }): PayState =>
  m.outstandingPoisha <= 0 ? { kind: 'none' } : m.onlineFees && m.linked ? { kind: 'online' } : { kind: 'counter', reason: null };

// ---------------------------------------------------------------- requests (M24-FR-15, FR-16)
export type RequestView = 'answer' | 'cancel' | 'waiting_gym' | 'expired' | 'closed';
type RequestLike = { direction: 'gym_invite' | 'join_request'; status: string; canCancel: boolean; expiresAt: string };

/**
 * What a request lets me do: answer a gym's invite (Accept, Decline), cancel my own join request,
 * or nothing (it waits for the gym, it expired, or it was answered). A pending row past its expiry
 * counts as expired before the job flips it.
 */
export function requestState(r: RequestLike, now: number = Date.now()): RequestView {
  if (r.status === 'expired' || (r.status === 'pending' && Date.parse(r.expiresAt) <= now)) return 'expired';
  if (r.status !== 'pending') return 'closed';
  if (r.direction === 'gym_invite') return 'answer';
  return r.canCancel ? 'cancel' : 'waiting_gym';
}

/** Invites waiting for my answer (the badge; my own join requests wait for the gym, so they don't count). */
export const waitingInvites = (items: readonly RequestLike[] | undefined, now: number = Date.now()) => (items ?? []).filter((r) => requestState(r, now) === 'answer').length;

/** Pending and expired lists merged once (a row can be in both while the expiry job runs), split for the screen. */
export function splitRequests<T extends RequestLike & { id: string }>(lists: readonly (readonly T[] | undefined)[], now: number = Date.now()) {
  const byId = new Map<string, T>();
  for (const list of lists) for (const r of list ?? []) if (!byId.has(r.id)) byId.set(r.id, r);
  const all = [...byId.values()];
  return {
    invites: all.filter((r) => r.direction === 'gym_invite' && requestState(r, now) !== 'expired'),
    joins: all.filter((r) => r.direction === 'join_request' && requestState(r, now) !== 'expired'),
    expired: all.filter((r) => requestState(r, now) === 'expired'),
  };
}

// ---------------------------------------------------------------- pay screen (M06 purposes)
export type PayKind = 'gym_fee' | 'gym_pass' | 'trainer' | 'entry';

/** Which words and Done target the pay screen uses for a payment's purpose. */
export function payKind(purpose: string | null | undefined): PayKind {
  if (purpose === 'gym_membership_fee') return 'gym_fee';
  if (purpose === 'gym_package') return 'gym_pass';
  if (purpose === 'trainer_subscription') return 'trainer';
  return 'entry';
}

/** Where Done goes: back to the membership (or my gyms), my passes, my subscriptions, or my matches. */
export function payDoneRoute(kind: PayKind, memberId?: string | null): string {
  switch (kind) {
    case 'gym_fee':
      return memberId ? `/gym/${memberId}` : '/gym';
    case 'gym_pass':
      return '/gym/passes';
    case 'trainer':
      return '/gym/subscriptions';
    default:
      return '/matches';
  }
}

// ---------------------------------------------------------------- clock times of the day ("18:30")
const toMinute = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const toHhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Minutes after midnight in Dhaka now (UTC+6, no daylight saving). */
export const dhakaMinuteNow = (now: number | Date = Date.now()) => Math.floor(((new Date(now).getTime() + DHAKA_MS) % DAY_MS) / 60_000);

/** "18:30" as "6:30 pm" / "সন্ধ্যা ৬:৩০", the way timeOnly writes an instant. */
export const clockTime = (hhmm: string, lang: Lang = 'en') => timeOnly(`2000-01-01T${hhmm}:00+06:00`, lang);

/** Minutes worked as hours and minutes: 135 → { h: 2, m: 15 }. */
export const hoursMinutes = (minutes: number) => ({ h: Math.floor(Math.max(0, minutes) / 60), m: Math.max(0, minutes) % 60 });

// ---------------------------------------------------------------- classes (M27-FR-48 to FR-50)
export type ClassLike = { status: string; startsAt: string; spaces: number; myBooking?: { id: string; status: string } | null };
/** What a member can do with a session: cancel their place, book one, join the waitlist, or nothing. */
export type ClassAction = 'cancel' | 'book' | 'waitlist' | 'none';

export function classAction(s: ClassLike, now: number = Date.now()): ClassAction {
  if (s.status !== 'scheduled' || Date.parse(s.startsAt) <= now) return 'none';
  const mine = s.myBooking?.status;
  if (mine === 'booked' || mine === 'waitlisted') return 'cancel';
  return s.spaces > 0 ? 'book' : 'waitlist';
}

/** Sessions by Dhaka date, in order, for the day headings. */
export function byDay<T extends { localDate: string; startsAt: string }>(items: readonly T[]): { date: string; items: T[] }[] {
  const days = new Map<string, T[]>();
  for (const s of [...items].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) days.set(s.localDate, [...(days.get(s.localDate) ?? []), s]);
  return [...days].map(([date, list]) => ({ date, items: list }));
}

// ---------------------------------------------------------------- free trial visits (M24 §17; mirrors apps/gym lib/gym-visits.ts)
export type VisitWindow = { openTime: string; closeTime: string };
export type VisitDayLike = { date: string; windows: readonly unknown[]; placesLeft: number };
export type VisitLike = { status: string; date: string; arriveAt: string; token?: string | null };

const windowsOf = (windows: readonly unknown[]) => windows.filter((w): w is VisitWindow => !!w && typeof (w as VisitWindow).openTime === 'string' && typeof (w as VisitWindow).closeTime === 'string');

/**
 * The arrival times offered on a day: every `step` minutes inside each opening window (the closing time
 * itself is not inside), and on today only times after `nowMinute`. Sorted, without repeats.
 */
export function visitTimes(windows: readonly unknown[], { isToday = false, nowMinute = 0, step = 30 }: { isToday?: boolean; nowMinute?: number; step?: number } = {}): string[] {
  const out = new Set<number>();
  for (const w of windowsOf(windows)) {
    const close = toMinute(w.closeTime);
    for (let m = Math.ceil(toMinute(w.openTime) / step) * step; m < close; m += step) if (!isToday || m > nowMinute) out.add(m);
  }
  return [...out].sort((a, b) => a - b).map(toHhmm);
}

/** The days a person can still pick: open, with a place left, and (today) with a time still ahead. */
export const bookableDays = <T extends VisitDayLike>(days: readonly T[], at: { today: string; nowMinute: number }): T[] =>
  days.filter((d) => d.placesLeft > 0 && visitTimes(d.windows, { isToday: d.date === at.today, nowMinute: at.nowMinute }).length > 0);

/** The guest's visits for the screen: what is coming (booked with its QR, soonest first) and the rest as the API sent them (newest first). */
export function splitVisits<T extends VisitLike>(items: readonly T[]): { coming: T[]; past: T[] } {
  const coming = items.filter((v) => v.status === 'booked' && v.token).sort((a, b) => (a.date + a.arriveAt).localeCompare(b.date + b.arriveAt));
  return { coming, past: items.filter((v) => !coming.includes(v)) };
}

/** The 6-character visit code in two groups of three, easier to read out at the desk. */
export const codeGroups = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

// ---------------------------------------------------------------- my work at a gym (M27-FR-73)
/** The gyms where I am staff and may clock myself in (the owner never clocks in). */
export const clockWorkplaces = <T extends { role: string; permissions?: readonly unknown[] | null }>(gyms: readonly T[] | undefined): T[] =>
  (gyms ?? []).filter((g) => g.role === 'staff' && (g.permissions ?? []).includes('clock.in'));
