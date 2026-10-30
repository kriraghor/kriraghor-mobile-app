/**
 * Guest browsing, like the websites: anyone can look around (the hub, events, ranks, player pages,
 * the gym directory and gym pages) and sign-in is asked only when they act. An action that needs an
 * account opens the sign-in modal; once signed in the modal closes back to the same screen and the
 * action carries on. Pure (the action table and the one pending action), so it is unit-tested.
 */
export type Action =
  // open to everyone
  | 'browse_events'
  | 'browse_ranks'
  | 'browse_gyms'
  | 'open_website'
  // need an account
  | 'register_event'
  | 'esports_checkin'
  | 'see_room'
  | 'withdraw'
  | 'buy_pass'
  | 'join_gym'
  | 'pay'
  | 'tick_plan'
  | 'gym_checkin'
  | 'my_matches'
  | 'my_gyms';

export const NEEDS_ACCOUNT: Record<Action, boolean> = {
  browse_events: false,
  browse_ranks: false,
  browse_gyms: false,
  open_website: false,
  register_event: true,
  esports_checkin: true,
  see_room: true,
  withdraw: true,
  buy_pass: true,
  join_gym: true,
  pay: true,
  tick_plan: true,
  gym_checkin: true,
  my_matches: true,
  my_gyms: true,
};

export type AuthStatus = 'loading' | 'signed_in' | 'signed_out';

/** Whether this action has to wait for a sign-in (while the session is still loading, it does). */
export const needsSignIn = (action: Action, status: AuthStatus) => NEEDS_ACCOUNT[action] && status !== 'signed_in';

type Pending = { action: Action; run: () => void };
let pending: Pending | null = null;

/** Keep the action to carry on with after the sign-in (only the latest one). */
export function deferUntilSignedIn(action: Action, run: () => void) {
  pending = { action, run };
}

/** The action waiting for the sign-in, removed so it runs once. */
export function takePending(): Pending | null {
  const p = pending;
  pending = null;
  return p;
}

/** The sign-in was closed without signing in: forget the action. */
export function clearPending() {
  pending = null;
}

export const pendingAction = (): Action | null => pending?.action ?? null;
