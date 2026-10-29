import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useAuth } from './auth';
import { ApiError, idempotencyKey } from './esports-api';
import { myMemberships, myPlans, myRequests, payDue } from './gym-api';
import { waitingInvites } from './gym';
import { keys } from './use-realtime';

/** My gyms (current and past), shared by the gym list, the membership page and the check-in QR. */
export function useMyGyms() {
  const { status } = useAuth();
  return useQuery({ queryKey: keys.gymMemberships, queryFn: myMemberships, enabled: status === 'signed_in' });
}

/** My plans and diet charts across my gyms, with today's date and how far back I can tick. */
export function useMyPlans() {
  const { status } = useAuth();
  return useQuery({ queryKey: keys.gymPlans, queryFn: myPlans, enabled: status === 'signed_in' });
}

/** Pending gym requests (invites to me and my join requests). */
export function usePendingRequests() {
  const { status } = useAuth();
  return useQuery({ queryKey: keys.gymRequests('pending'), queryFn: async () => (await myRequests('pending')).items, enabled: status === 'signed_in' });
}

/** Gym invites waiting for my answer: the Gym row's badge and part of the Account tab's badge. */
export function useWaitingInvites(): number {
  const pending = usePendingRequests();
  return waitingInvites(pending.data);
}

/**
 * Pay one due (M24-FR-41): POST /me/gym-dues/:dueId/pay creates (or reuses) the payment, then the app
 * pays it on pay/[paymentId] like an esports entry; Done comes back to the membership. A retry after a
 * network failure reuses the same Idempotency-Key; an answer from the API (or success) starts a new one.
 */
export function usePayDue() {
  const keysByDue = useRef(new Map<string, string>());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  async function pay(dueId: string, memberId: string) {
    if (busy) return;
    setBusy(dueId);
    setError(null);
    const key = keysByDue.current.get(dueId) ?? idempotencyKey('gymdue');
    keysByDue.current.set(dueId, key);
    try {
      const start = await payDue(dueId, key);
      keysByDue.current.delete(dueId);
      router.push({ pathname: '/pay/[paymentId]', params: { paymentId: start.paymentId, memberId } });
    } catch (err) {
      if (err instanceof ApiError) keysByDue.current.delete(dueId);
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  return { pay, busy, error };
}
