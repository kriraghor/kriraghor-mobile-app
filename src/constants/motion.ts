import { duration, radius } from './tokens';

/**
 * The app's shape and motion system (the shape rule and the timings come from the shared tokens): one radius scale, an 8-pt spacing rhythm, and the durations and
 * springs every animation uses. Motion only moves transform and opacity, is motivated (entrance,
 * feedback, state change), never loops for decoration and honours the phone's reduce-motion setting
 * (Reanimated useReducedMotion / ReduceMotion.System: instant or a plain fade).
 */
export const Radius = {
  /** Tiles, cards, sheets. */
  card: radius.card,
  /** Buttons, inputs, rows, code boxes. */
  control: radius.control,
  /** Pills and chips. */
  pill: 999,
} as const;

/** 8-pt rhythm (4 for hairline gaps). */
export const Space = { xs: 4, s: 8, m: 16, l: 24, xl: 32 } as const;

export const Duration = {
  /** Press feedback, small state changes (the shared "fast"). */
  micro: duration.fast,
  /** Screen and list entrances (the shared "base"). */
  enter: duration.base,
  /** The hub's zoom into or out of a section (≤ 400 ms). */
  zoom: 350,
  /** A plain crossfade when reduce motion is on. */
  fade: 200,
  /** A prize, a balance or points counting up to its value. */
  count: 600,
} as const;

/** Each list item or tile starts this much after the one before, up to STAGGER_MAX items. */
export const STAGGER_MS = 40;
export const STAGGER_MAX = 8;
/** Entrances rise by this many points while fading in. */
export const ENTER_OFFSET = 12;
/** A pressed card or button shrinks to this. */
export const PRESS_SCALE = 0.97;

/** Springs (Reanimated withSpring configs). */
export const Springs = {
  press: { damping: 18, stiffness: 320, mass: 0.6 },
  zoom: { damping: 24, stiffness: 190, mass: 0.9, overshootClamping: true },
} as const;
