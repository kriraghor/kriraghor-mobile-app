import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useAuth } from './auth';
import { getSocket, joinRoom, reconnectRealtime } from './realtime';
import { acceptCredentials, type RoomCredentials } from './room-credentials';

/** Query keys shared by screens and live events. */
export const keys = {
  events: (group: string, game?: string) => ['events', group, game ?? 'all'] as const,
  event: (id: string) => ['event', id] as const,
  registrations: ['registrations'] as const,
  profiles: ['profiles'] as const,
  room: (matchId: string) => ['room', matchId] as const,
  match: (matchId: string) => ['match', matchId] as const,
  notifications: ['notifications'] as const,
  unread: ['unread'] as const,
  // Gym (M24 §4.5): every key starts with 'gym', so keys.gym refreshes them all (after paying, say).
  gym: ['gym'] as const,
  gymMemberships: ['gym', 'memberships'] as const,
  gymMembership: (memberId: string) => ['gym', 'membership', memberId] as const,
  gymAttendance: (memberId: string, month: string) => ['gym', 'attendance', memberId, month] as const,
  gymRequests: (status: 'pending' | 'expired') => ['gym', 'requests', status] as const,
  gymDues: ['gym', 'dues'] as const,
  gymPlans: ['gym', 'plans'] as const,
  gymPlan: (assignmentId: string) => ['gym', 'plan', assignmentId] as const,
  gymPasses: (group: string) => ['gym', 'passes', group] as const,
  gymPass: (code: string) => ['gym', 'pass', code] as const,
  gymSubscriptions: ['gym', 'subscriptions'] as const,
};

/**
 * Mounted once (root layout): keeps the socket connected as the current user, and turns user events
 * into fresh data. Room credentials from the socket go to the in-memory store only.
 */
export function useRealtimeBridge() {
  const { status } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (status === 'loading') return;
    reconnectRealtime(); // the handshake carries the new identity (or none)
  }, [status]);

  useEffect(() => {
    const s = getSocket();
    const onRoom = (p: RoomCredentials) => {
      if (p?.matchId && typeof p.version === 'number') acceptCredentials(p);
      void qc.invalidateQueries({ queryKey: keys.registrations });
    };
    const onBell = () => {
      void qc.invalidateQueries({ queryKey: keys.unread });
      void qc.invalidateQueries({ queryKey: keys.notifications });
      // A gym invite, a plan or a receipt arrives as a notification: re-read what the gym screens show.
      void qc.invalidateQueries({ queryKey: keys.gym });
    };
    const onConnect = () => {
      onBell();
      void qc.invalidateQueries({ queryKey: keys.registrations });
    };
    s.on('esports.room_revealed', onRoom);
    s.on('esports.room_rotated', onRoom);
    s.on('notification.created', onBell);
    s.on('notification.read', onBell);
    s.on('connect', onConnect);
    return () => {
      s.off('esports.room_revealed', onRoom);
      s.off('esports.room_rotated', onRoom);
      s.off('notification.created', onBell);
      s.off('notification.read', onBell);
      s.off('connect', onConnect);
    };
  }, [qc]);
}

/** Join a public room while the screen is shown, and run `onEvent` for the listed events. */
export function useRoomEvents(room: string | null, events: string[], onEvent: (event: string, payload: unknown) => void) {
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  });
  const list = events.join(',');
  useEffect(() => {
    if (!room) return;
    const leave = joinRoom(room);
    const s = getSocket();
    const subs = list.split(',').map((e) => {
      const fn = (payload: unknown) => handler.current(e, payload);
      s.on(e, fn);
      return () => s.off(e, fn);
    });
    return () => {
      subs.forEach((off) => off());
      leave();
    };
  }, [room, list]);
}
