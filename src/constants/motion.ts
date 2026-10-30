/**
 * The app's shape and motion system: one radius scale, an 8-pt spacing rhythm, and the durations and
 * springs every animation uses. Motion only moves transform and opacity, is motivated (entrance,
 * feedback, state change), never loops for decoration and honours the phone's reduce-motion setting
 * (Reanimated useReducedMotion / ReduceMotion.System: instant or a plain fade).
 */
export const Radius = {
  /** Tiles, cards, sheets. */
  card: 20,
  /** Buttons, inputs, rows, code boxes. */
  control: 12,
  /** Pills and chips. */
  pill: 999,
} as const;

/** 8-pt rhythm (4 for hairline gaps). */
export const Space = { xs: 4, s: 8, m: 16, l: 24, xl: 32 } as const;

export const Duration = {
  /** Press feedback, small state changes (150–300 ms). */
  micro: 180,
  /** Screen and list entrances. */
  enter: 260,
  /** The hub's zoom into or out of a section (≤ 400 ms). */
  zoom: 350,
  /** A plain crossfade when reduce motion is on. */
  fade: 200,
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
