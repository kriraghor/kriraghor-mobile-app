import { outcomeOf, payInApp, POLL_DELAYS_MS, RETURN_BASE, type PayDeps, type PaymentStatus } from '../payment-flow';

function deps(statuses: PaymentStatus[], browser: { type: string; url?: string } = { type: 'success', url: `${RETURN_BASE}/p1/result` }) {
  const queue = [...statuses];
  const calls: string[] = [];
  const d: PayDeps = {
    startAttempt: jest.fn(async (id, method, key) => {
      calls.push(`attempt:${id}:${method}:${key}`);
      return { redirectUrl: 'https://sandbox.gateway/pay/SIM1' };
    }),
    openAuthSession: jest.fn(async (url, ret) => {
      calls.push(`browser:${url}:${ret}`);
      return browser;
    }),
    verify: jest.fn(async () => {
      calls.push('verify');
      return queue.shift() ?? 'pending';
    }),
    status: jest.fn(async () => {
      calls.push('status');
      return queue.shift() ?? 'pending';
    }),
    wait: jest.fn(async () => undefined),
  };
  return { d, calls };
}

describe('paying from the app (M06, returnTo app)', () => {
  it('starts the attempt with the key, opens the gateway with the app return URL, and trusts the API', async () => {
    const { d, calls } = deps(['succeeded']);
    expect(await payInApp('p1', 'bkash', 'reg-k1', d)).toBe('paid');
    expect(calls).toEqual(['attempt:p1:bkash:reg-k1', `browser:https://sandbox.gateway/pay/SIM1:${RETURN_BASE}`, 'verify']);
  });

  it('a browser closed by hand still finds a payment that went through', async () => {
    const { d } = deps(['pending', 'succeeded'], { type: 'cancel' });
    expect(await payInApp('p1', 'nagad', 'k', d)).toBe('paid');
    expect(d.wait).toHaveBeenCalledTimes(1);
  });

  it('a return URL that claims success means nothing until the API agrees', async () => {
    const { d } = deps(['failed'], { type: 'success', url: `${RETURN_BASE}/p1/result?status=success` });
    expect(await payInApp('p1', 'card', 'k', d)).toBe('failed');
  });

  it('cancelled, expired, and still pending after every poll', async () => {
    expect(await payInApp('p1', 'bkash', 'k', deps(['cancelled']).d)).toBe('cancelled');
    expect(await payInApp('p1', 'bkash', 'k', deps(['expired']).d)).toBe('expired');
    const slow = deps([]);
    expect(await payInApp('p1', 'bkash', 'k', slow.d)).toBe('pending');
    expect(slow.d.wait).toHaveBeenCalledTimes(POLL_DELAYS_MS.length);
  });

  it('a verify or status call that fails counts as not settled yet, then polling continues', async () => {
    const { d } = deps([]);
    (d.verify as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    (d.status as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('succeeded');
    expect(await payInApp('p1', 'bkash', 'k', d)).toBe('paid');
  });

  it('a failure to start the attempt reaches the screen (nothing was charged)', async () => {
    const { d } = deps([]);
    (d.startAttempt as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('expired'), { code: 'PAYMENT_EXPIRED' }));
    await expect(payInApp('p1', 'bkash', 'k', d)).rejects.toThrow('expired');
    expect(d.openAuthSession).not.toHaveBeenCalled();
  });

  it('maps every payment status', () => {
    expect(['succeeded', 'partially_refunded', 'refunded'].map(outcomeOf)).toEqual(['paid', 'paid', 'paid']);
    expect(['initiated', 'pending', 'something_new'].map(outcomeOf)).toEqual([null, null, null]);
  });
});
