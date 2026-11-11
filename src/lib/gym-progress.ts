import type { BodyEntry, BodyProgress, MyRenewal, RenewalChoice, RenewPay } from './gym-api';

/**
 * M24 §19 and §20 in the app (mirrors gym.kriraghor.com lib/gym-progress.ts): where a member stands with
 * renewing their own membership, and the body-progress form and chart. Pure: the API enforces every rule.
 */
export const BODY_FIELDS = ['weightKg', 'bodyFatPct', 'chestCm', 'waistCm', 'hipsCm', 'armCm', 'thighCm'] as const;
export type BodyField = (typeof BODY_FIELDS)[number];
/** The unit each measurement is shown in. */
export const BODY_UNIT: Record<BodyField, 'kg' | 'pct' | 'cm'> = { weightKg: 'kg', bodyFatPct: 'pct', chestCm: 'cm', waistCm: 'cm', hipsCm: 'cm', armCm: 'cm', thighCm: 'cm' };

// ---------------------------------------------------------------- renewal

/**
 * What the renew card shows: `renew` (the member can renew now), `waiting` (a renewal already waits to
 * start), `later` (too early, with the first day), `desk` (the gym takes renewals at the front desk), or
 * `none` (left, removed, or nothing to renew: no card).
 */
export type RenewState = { kind: 'renew' } | { kind: 'waiting' } | { kind: 'later'; on: string | null } | { kind: 'desk' } | { kind: 'none' };
export function renewState(r: Pick<MyRenewal, 'can' | 'reason' | 'renewal' | 'opensOn'>): RenewState {
  if (r.renewal) return { kind: 'waiting' };
  if (r.can) return { kind: 'renew' };
  if (r.reason === 'GYM_RENEW_TOO_EARLY') return { kind: 'later', on: r.opensOn };
  if (r.reason === 'GYM_SELF_RENEW_OFF') return { kind: 'desk' };
  return { kind: 'none' };
}

/** The package picked at first: the member's current one, else the first offered. */
export const firstChoice = (packages: readonly RenewalChoice[]): RenewalChoice | null => packages.find((p) => p.current) ?? packages[0] ?? null;

/** How the member pays at first: online when the gym takes fees online, else at the counter. */
export const firstPay = (r: Pick<MyRenewal, 'onlineFees'>): RenewPay => (r.onlineFees ? 'online' : 'counter');

// ---------------------------------------------------------------- body progress

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
/** A typed measurement ("78.4", "৭৮.৪", "78,4") as a number with one decimal; null when it is not one. "" is left out. */
export function measureOf(text: string): number | null | undefined {
  const s = text
    .trim()
    .replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)))
    .replace(',', '.');
  if (!s) return undefined;
  if (!/^\d{1,3}(\.\d)?$/.test(s)) return null;
  return Number(s);
}

export type BodyDraft = Record<BodyField, string>;
export const emptyDraft = (): BodyDraft => ({ weightKg: '', bodyFatPct: '', chestCm: '', waistCm: '', hipsCm: '', armCm: '', thighCm: '' });

/** The form as typed → what is sent, the fields that are not a number inside their range, and whether nothing was entered. */
export function bodyValues(draft: BodyDraft, limits: BodyProgress['limits']['fields']): { values: Partial<Record<BodyField, number>>; bad: BodyField[]; empty: boolean } {
  const values: Partial<Record<BodyField, number>> = {};
  const bad: BodyField[] = [];
  for (const k of BODY_FIELDS) {
    const v = measureOf(draft[k]);
    if (v === undefined) continue;
    if (v === null || v < limits[k].min || v > limits[k].max) bad.push(k);
    else values[k] = v;
  }
  return { values, bad, empty: !bad.length && !Object.keys(values).length };
}

/** The measurements that have at least one entry, in the fixed order (the chart's picker). */
export const fieldsWithData = (entries: readonly BodyEntry[]): BodyField[] => BODY_FIELDS.filter((k) => entries.some((e) => e[k] != null));

/** One measurement over time, oldest first: only the entries that have it. */
export const seriesOf = (entries: readonly BodyEntry[], field: BodyField): { date: string; value: number }[] =>
  entries.flatMap((e) => (e[field] == null ? [] : [{ date: e.measuredOn, value: e[field] as number }]));

/**
 * The chart's vertical range: from a little under the lowest value to a little over the highest, so a few
 * kilos of change are visible (both ends are printed, so it is not read as starting at zero). A flat
 * series gets one unit either side.
 */
export function chartRange(values: readonly number[]): { min: number; max: number } {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = hi === lo ? 1 : (hi - lo) * 0.15;
  return { min: Math.floor((lo - pad) * 10) / 10, max: Math.ceil((hi + pad) * 10) / 10 };
}

/**
 * Where each point sits in a w × h plot with a margin: across by its date (so a long gap between two
 * measurements looks long), up by its value. One point, or all on one day, sits in the middle.
 */
export function chartPoints(series: readonly { date: string; value: number }[], { w, h, pad }: { w: number; h: number; pad: number }): { x: number; y: number }[] {
  if (!series.length) return [];
  const { min, max } = chartRange(series.map((p) => p.value));
  const at = (d: string) => Date.parse(`${d}T00:00:00Z`);
  const first = at(series[0].date);
  const span = at(series[series.length - 1].date) - first;
  return series.map((p) => ({ x: span > 0 ? pad + ((at(p.date) - first) / span) * (w - 2 * pad) : w / 2, y: pad + (1 - (p.value - min) / (max - min)) * (h - 2 * pad) }));
}
