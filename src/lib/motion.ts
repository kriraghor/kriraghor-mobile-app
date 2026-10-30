import { STAGGER_MAX, STAGGER_MS } from '@/constants/motion';

/** Pure maths behind the app's animations, unit-tested without a phone. */

/** The entrance delay of the n-th item: 40 ms apart, capped so a long list never waits. */
export const staggerDelay = (index: number, step: number = STAGGER_MS, max: number = STAGGER_MAX) => Math.max(0, Math.min(Math.floor(index), max)) * step;
