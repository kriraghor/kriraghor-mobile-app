/**
 * Paying from the app (M06 "Paying from the mobile app"). The attempt is started with
 * returnTo 'app', the gateway opens in an auth session that closes when the gateway sends the payer
 * to kriraghor://pay/{paymentId}/result, and the result is always read from the API (verify, then
 * poll) — never from the redirect or from how the browser was closed (M06-FR-03). Closing the
 * browser after paying still finds the payment.
 *
 * Every dependency is passed in, so the flow is tested without a browser or a network.
 */
export type PayMethod = 'bkash' | 'nagad' | 'card';
export type PayOutcome = 'paid' | 'failed' | 'cancelled' | 'expired' | 'pending';
export type PaymentStatus = 'initiated' | 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'expired' | string;

export type PayDeps = {
  /** POST /payments/{id}/attempts with the Idempotency-Key; resolves to the gateway URL. */
  startAttempt: (paymentId: string, method: PayMethod, key: string) => Promise<{ redirectUrl: string }>;
  /** expo-web-browser openAuthSessionAsync. */
  openAuthSession: (url: string, returnUrl: string) => Promise<{ type: string; url?: string }>;
  /** POST /payments/{id}/verify: ask the provider now; resolves to the payment status. */
  verify: (paymentId: string) => Promise<PaymentStatus>;
  /** GET /payments/{id}: the payment status. */
  status: (paymentId: string) => Promise<PaymentStatus>;
  wait: (ms: number) => Promise<void>;
};

export const RETURN_BASE = 'kriraghor://pay';
/** After the browser closes: verify once, then read the status a few times (the IPN may be a moment behind). */
export const POLL_DELAYS_MS = [1500, 3000, 5000, 8000];

export function outcomeOf(status: PaymentStatus): PayOutcome | null {
  switch (status) {
    case 'succeeded':
    case 'partially_refunded':
    case 'refunded':
      return 'paid';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    case 'expired':
      return 'expired';
    default:
      return null; // initiated, pending: not settled yet
  }
}

export async function payInApp(paymentId: string, method: PayMethod, key: string, deps: PayDeps): Promise<PayOutcome> {
  const { redirectUrl } = await deps.startAttempt(paymentId, method, key);
  await deps.openAuthSession(redirectUrl, RETURN_BASE);

  const first = outcomeOf(await deps.verify(paymentId).catch(() => 'pending' as PaymentStatus));
  if (first) return first;
  for (const ms of POLL_DELAYS_MS) {
    await deps.wait(ms);
    const next = outcomeOf(await deps.status(paymentId).catch(() => 'pending' as PaymentStatus));
    if (next) return next;
  }
  return 'pending';
}
