import { addDays } from './gym';

/**
 * The public gym directory and a gym's page (M20 §4, M24 §4.1), ported from gym.kriraghor.com
 * lib/gym.ts: the list query, the dates a pass can be bought for, the week's hours (Saturday first)
 * and where I stand with a gym (member, request waiting, free to ask). Dates are Dhaka calendar dates.
 */
export type GymSort = 'price' | 'rating' | 'newest';
export const GYM_SORTS: GymSort[] = ['price', 'rating', 'newest'];
/** Monthly price caps offered as chips, in taka (sent as poisha). */
export const PRICE_CAPS = [1500, 2500, 4000];

export type GymFilters = { areaId?: string; sort?: GymSort; priceMaxTaka?: number; cursor?: string };

export function gymListParams(f: GymFilters, limit = 24): Record<string, string | number> {
  const out: Record<string, string | number> = { limit, sort: f.sort && GYM_SORTS.includes(f.sort) ? f.sort : 'price' };
  if (f.areaId) out.areaId = f.areaId;
  if (f.priceMaxTaka && f.priceMaxTaka > 0) out.priceMax = Math.round(f.priceMaxTaka * 100);
  if (f.cursor) out.cursor = f.cursor;
  return out;
}

type Hours = { dow: number; openTime: string; closeTime: string; womenOnly: boolean }[];

export const dowOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

/** Hours grouped by weekday, Saturday first (the Bangladesh week). */
export function weekOf(hours: Hours): { dow: number; windows: Hours }[] {
  return [6, 0, 1, 2, 3, 4, 5].map((dow) => ({ dow, windows: hours.filter((h) => h.dow === dow).sort((a, b) => a.openTime.localeCompare(b.openTime)) }));
}

/** The dates a pass can start: a day pass only on open days, longer passes on any of the next `advanceDays`. */
export function passDates(kind: string, hours: Hours, today: string, advanceDays: number): string[] {
  const days = Array.from({ length: Math.max(0, advanceDays) }, (_, i) => addDays(today, i));
  return kind === 'day' ? days.filter((d) => hours.some((h) => h.dow === dowOf(d))) : days;
}

/** The packages a member can ask for when joining: not day passes, and not sold at the desk only. */
export const joinablePackages = <P extends { kind: string; channel?: string }>(packages: P[]) => packages.filter((p) => p.kind !== 'day' && (p.channel ?? 'online') !== 'desk');

type Membership = { memberId: string; linked: boolean; status: string; gym: { id: string } | null };
type Request = { id: string; direction: string; status: string; gym: { id: string } | null };

/** Where I stand with one gym: already a member, a join request waiting, or free to ask. */
export function joinState(gymId: string, memberships: Membership[] | undefined, requests: Request[] | undefined): { kind: 'member'; memberId: string } | { kind: 'pending' } | { kind: 'open' } {
  const member = (memberships ?? []).find((m) => m.gym?.id === gymId && m.linked && m.status !== 'left' && m.status !== 'removed');
  if (member) return { kind: 'member', memberId: member.memberId };
  if ((requests ?? []).some((r) => r.gym?.id === gymId && r.direction === 'join_request' && r.status === 'pending')) return { kind: 'pending' };
  return { kind: 'open' };
}

/** "4.6" for a rating, null when the gym has none yet. */
export const ratingText = (avg: number | null, count: number) => (avg !== null && count > 0 ? (Math.round(avg * 10) / 10).toFixed(1) : null);

/** The filters a person has set in the directory's sheet (the sort is shown on its own button). */
export type DirectoryFilters = { areaId?: string; priceMaxTaka?: number; sort: GymSort };
export const NO_FILTERS: DirectoryFilters = { sort: 'price' };

/** How many filters are on, for the Filters button's badge (area and price; the sort is not a filter). */
export const activeFilterCount = (f: DirectoryFilters) => (f.areaId ? 1 : 0) + (f.priceMaxTaka ? 1 : 0);

/** Areas whose English or Bangla name contains what was typed (case-insensitive); all of them for an empty search. */
export function searchAreas<A extends { nameEn: string; nameBn: string }>(areas: A[], q: string): A[] {
  const s = q.trim().toLowerCase();
  if (!s) return areas;
  return areas.filter((a) => a.nameEn.toLowerCase().includes(s) || a.nameBn.includes(q.trim()));
}
