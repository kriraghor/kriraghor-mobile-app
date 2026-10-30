import { STAGGER_MAX, STAGGER_MS } from '@/constants/motion';

/** Pure maths behind the app's animations, unit-tested without a phone. */

export type Rect = { x: number; y: number; width: number; height: number };
export type Size = { width: number; height: number };
export type ZoomTransform = { translateX: number; translateY: number; scaleX: number; scaleY: number };

/** The identity: the overlay fills the screen. */
export const FULL: ZoomTransform = { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1 };

/**
 * The transform that makes a full-screen overlay sit exactly on a tile measured on screen (React
 * Native scales around the centre, so move the centres together, then scale). The hub animates from
 * this to FULL to zoom into a section, and back to zoom out.
 */
export function zoomFrom(rect: Rect, screen: Size): ZoomTransform {
  if (screen.width <= 0 || screen.height <= 0 || rect.width <= 0 || rect.height <= 0) return FULL;
  return {
    translateX: rect.x + rect.width / 2 - screen.width / 2,
    translateY: rect.y + rect.height / 2 - screen.height / 2,
    scaleX: rect.width / screen.width,
    scaleY: rect.height / screen.height,
  };
}

/** Between the tile (0) and full screen (1). */
export function lerpZoom(from: ZoomTransform, p: number): ZoomTransform {
  'worklet';
  const k = Math.min(1, Math.max(0, p));
  return {
    translateX: from.translateX * (1 - k),
    translateY: from.translateY * (1 - k),
    scaleX: from.scaleX + (1 - from.scaleX) * k,
    scaleY: from.scaleY + (1 - from.scaleY) * k,
  };
}

/** The entrance delay of the n-th item: 40 ms apart, capped so a long list never waits. */
export const staggerDelay = (index: number, step: number = STAGGER_MS, max: number = STAGGER_MAX) => Math.max(0, Math.min(Math.floor(index), max)) * step;
