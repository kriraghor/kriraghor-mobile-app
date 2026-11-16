import { clearPending, deferUntilSignedIn, NEEDS_ACCOUNT, needsSignIn, pendingAction, takePending, type Action } from '../guest';
import { countStep, staggerDelay } from '../motion';

describe('guest browsing: which actions need an account', () => {
  const open: Action[] = ['browse_events', 'browse_ranks', 'browse_gyms', 'open_website'];
  const gated: Action[] = ['register_event', 'esports_checkin', 'see_room', 'withdraw', 'buy_pass', 'join_gym', 'pay', 'tick_plan', 'gym_checkin', 'my_matches', 'my_gyms'];

  it('the table lists every action once', () => {
    expect(Object.keys(NEEDS_ACCOUNT).sort()).toEqual([...open, ...gated].sort());
  });

  it.each(open)('%s is open to guests', (a) => {
    expect(needsSignIn(a, 'signed_out')).toBe(false);
    expect(needsSignIn(a, 'loading')).toBe(false);
  });

  it.each(gated)('%s asks a guest to sign in, never a signed-in person', (a) => {
    expect(needsSignIn(a, 'signed_out')).toBe(true);
    expect(needsSignIn(a, 'loading')).toBe(true);
    expect(needsSignIn(a, 'signed_in')).toBe(false);
  });
});

describe('the action waiting for the sign-in', () => {
  it('runs once after the sign-in', () => {
    const run = jest.fn();
    deferUntilSignedIn('buy_pass', run);
    expect(pendingAction()).toBe('buy_pass');
    takePending()?.run();
    expect(run).toHaveBeenCalledTimes(1);
    expect(takePending()).toBeNull();
    expect(pendingAction()).toBeNull();
  });

  it('only the latest action is kept', () => {
    const first = jest.fn();
    const second = jest.fn();
    deferUntilSignedIn('join_gym', first);
    deferUntilSignedIn('register_event', second);
    const p = takePending();
    expect(p?.action).toBe('register_event');
    p?.run();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
  });

  it('closing the sign-in forgets it', () => {
    deferUntilSignedIn('pay', jest.fn());
    clearPending();
    expect(takePending()).toBeNull();
  });
});

describe('entrances', () => {
  it('staggers entrances 40 ms apart, capped', () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(3)).toBe(120);
    expect(staggerDelay(50)).toBe(320);
    expect(staggerDelay(-2)).toBe(0);
    expect(staggerDelay(2.7, 30, 4)).toBe(60);
  });
});

describe('a number counting up to its value', () => {
  it('starts at the old value and ends exactly on the new one', () => {
    expect(countStep(0, 350000, 0)).toBe(0);
    expect(countStep(0, 350000, 1)).toBe(350000);
    expect(countStep(120, 130, 1)).toBe(130);
  });
  it('moves fast at first and slows into the value, in whole numbers, never past it', () => {
    const half = countStep(0, 1000, 0.5);
    expect(half).toBe(875);
    expect(Number.isInteger(countStep(0, 999, 0.33))).toBe(true);
    for (let p = 0; p <= 1; p += 0.05) expect(countStep(0, 7, p)).toBeLessThanOrEqual(7);
  });
  it('counts down the same way when the value falls', () => {
    expect(countStep(1000, 0, 0.5)).toBe(125);
    for (let p = 0; p <= 1; p += 0.05) expect(countStep(50, 20, p)).toBeGreaterThanOrEqual(20);
    expect(countStep(50, 20, 1)).toBe(20);
  });
  it('treats progress outside 0 to 1 as its nearest end, and no change as no change', () => {
    expect(countStep(10, 90, -1)).toBe(10);
    expect(countStep(10, 90, 2)).toBe(90);
    expect(countStep(40, 40, 0.5)).toBe(40);
  });
});
