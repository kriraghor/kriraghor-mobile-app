import { STAGGER_MAX, STAGGER_MS } from '@/constants/motion';

/** Pure maths behind the app's animations, unit-tested without a phone. */

/** The entrance delay of the n-th item: 40 ms apart, capped so a long list never waits. */
export const staggerDelay = (index: number, step: number = STAGGER_MS, max: number = STAGGER_MAX) => Math.max(0, Math.min(Math.floor(index), max)) * step;

/**
 * Where a counting number stands at progress `p` (0 to 1) on its way from `from` to `to`: fast at first,
 * slowing into the value (ease-out cubic). Always a whole number, since it shows poisha, points or days;
 * exactly `to` at the end, and never past it on the way.
 */
export function countStep(from: number, to: number, p: number): number {
  const t = Math.max(0, Math.min(1, p));
  if (t >= 1) return to;
  const eased = 1 - (1 - t) ** 3;
  const at = Math.round(from + (to - from) * eased);
  return to >= from ? Math.min(at, to) : Math.max(at, to);
}
