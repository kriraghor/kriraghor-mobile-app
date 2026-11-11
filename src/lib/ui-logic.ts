/**
 * Pure logic behind round-2 UI pieces, unit-tested without a phone: the bottom sheet's open/close
 * phases and drag-to-dismiss rule, the tab bar's sliding indicator, and the hub's greeting.
 */

// ---------------------------------------------------------------- bottom sheet
export type SheetPhase = 'closed' | 'opening' | 'open' | 'closing';
export type SheetEvent = 'show' | 'opened' | 'hide' | 'closed';

/** The sheet's lifecycle: it stays mounted while closing so it can animate out, then unmounts. */
export function sheetPhase(phase: SheetPhase, event: SheetEvent): SheetPhase {
  switch (event) {
    case 'show':
      return phase === 'open' ? 'open' : 'opening';
    case 'opened':
      return phase === 'opening' ? 'open' : phase;
    case 'hide':
      return phase === 'closed' ? 'closed' : 'closing';
    case 'closed':
      return phase === 'closing' ? 'closed' : phase;
  }
}

/** Mounted (rendered) in every phase but closed. */
export const sheetMounted = (phase: SheetPhase) => phase !== 'closed';

/** A drag dismisses the sheet when it was flung down fast, or pulled past a third of its height. */
export const SHEET_FLING_VELOCITY = 900;
export function sheetShouldDismiss(translationY: number, velocityY: number, height: number): boolean {
  'worklet';
  if (velocityY > SHEET_FLING_VELOCITY) return true;
  if (velocityY < -SHEET_FLING_VELOCITY) return false;
  return height > 0 && translationY > height / 3;
}

/** Dragging up past the top is resisted (rubber band); down follows the finger. */
export function sheetDrag(translationY: number): number {
  'worklet';
  return translationY >= 0 ? translationY : -Math.sqrt(-translationY) * 2;
}

// ---------------------------------------------------------------- tab bar indicator
/** Where the active pill sits: equal-width items inside the bar's padding. */
export function tabIndicator(index: number, count: number, barWidth: number, padding = 6): { x: number; width: number } {
  if (count <= 0 || barWidth <= 0) return { x: 0, width: 0 };
  const width = Math.max(0, (barWidth - padding * 2) / count);
  const i = Math.min(Math.max(0, Math.floor(index)), count - 1);
  return { x: padding + i * width, width };
}

// ---------------------------------------------------------------- greeting
export type DayPart = 'morning' | 'afternoon' | 'evening';

/** The hour in Dhaka (UTC+6, no daylight saving). */
export const dhakaHour = (now: Date) => (now.getUTCHours() + 6) % 24;

/** Morning 4:00 to 11:59, afternoon 12:00 to 16:59, evening otherwise (Dhaka time). */
/**
 * What the hub's two main tiles can say right now (UI v2): how many tournaments are open, and the fewest
 * days left on any of my gym packages. Null means "say nothing": nothing loaded, none open, no package.
 */
export function hubLive({ openEvents, gymDaysLeft }: { openEvents: number | null; gymDaysLeft: readonly (number | null)[] }): { esports: number | null; gym: number | null } {
  const days = gymDaysLeft.filter((d): d is number => typeof d === 'number' && d >= 0);
  return { esports: openEvents && openEvents > 0 ? openEvents : null, gym: days.length ? Math.min(...days) : null };
}

export function dayPart(now: Date): DayPart {
  const h = dhakaHour(now);
  if (h >= 4 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  return 'evening';
}

export const firstName = (displayName: string | null | undefined) => (displayName ?? '').trim().split(/\s+/)[0] ?? '';

/** One or two letters for an avatar: the first letters of the first and last names. */
export function initials(displayName: string | null | undefined): string {
  const parts = (displayName ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  const first = Array.from(parts[0])[0] ?? '';
  const last = parts.length > 1 ? (Array.from(parts[parts.length - 1])[0] ?? '') : '';
  return (first + last).toUpperCase();
}
