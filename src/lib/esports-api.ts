import { randomUUID } from 'expo-crypto';
import { config } from './config';
import type { Game, Profile, RegisterResult, Registration, Squad, StatusGroup, TournamentCard, TournamentDetail } from './esports';
import { STATUS_GROUPS } from './esports';
import type { Gate, Leaderboard, PayoutAccount, PlayerPage, TopPlayer, Winnings, Withdrawable, Withdrawal } from './player';
import { createAuthFetch } from './session';

/**
 * Esports API calls (M21). Thin and untyped on purpose: the shapes are in esports.ts, checked by the
 * screens; openapi-fetch's generated types for these routes are loose (zod `.loose()` responses).
 * Errors throw ApiError with the problem+json code, so screens can map codes to texts.
 */
const authFetch = createAuthFetch();

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly problem: Record<string, unknown>
  ) {
    super(String(problem.title ?? code));
  }
}

/** A key for one user action; reuse it only to retry that same request. */
export const idempotencyKey = (action: string) => `${action}-${randomUUID()}`.slice(0, 80);

async function call<T>(method: string, path: string, opts: { query?: Record<string, string | number | undefined>; body?: unknown; key?: string; raw?: { bytes: Blob; type: string } } = {}): Promise<T> {
  const qs = opts.query ? new URLSearchParams(Object.entries(opts.query).filter(([, v]) => v !== undefined && v !== '') as [string, string][]).toString() : '';
  const headers = new Headers({ Accept: 'application/json' });
  if (opts.key) headers.set('Idempotency-Key', opts.key);
  let body: BodyInit | undefined;
  if (opts.raw) {
    headers.set('Content-Type', opts.raw.type);
    body = opts.raw.bytes;
  } else if (opts.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(opts.body);
  }
  const res = await authFetch(new Request(`${config.apiUrl}${path}${qs ? `?${qs}` : ''}`, { method, headers, body }));
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError(res.status, String(json.code ?? `HTTP_${res.status}`), json);
  return json as T;
}

// ---------------------------------------------------------------- events
export type Page<T> = { items: T[]; nextCursor: string | null };

/** One status group (open, upcoming, live, finished): the API takes one status, so the group is fetched in parallel and merged by start time. */
export async function listEvents(group: StatusGroup, game?: string): Promise<TournamentCard[]> {
  const pages = await Promise.all(STATUS_GROUPS[group].map((status) => call<Page<TournamentCard>>('GET', '/esports/tournaments', { query: { status, game, limit: 50 } })));
  const items = pages.flatMap((p) => p.items);
  const order = group === 'finished' ? -1 : 1;
  return items.sort((a, b) => order * (Date.parse(a.startsAt) - Date.parse(b.startsAt)));
}

export const getEvent = (idOrSlug: string) => call<TournamentDetail>('GET', `/esports/tournaments/${encodeURIComponent(idOrSlug)}`);
export const listGames = async () => (await call<{ items: Game[] }>('GET', '/esports/games')).items;

// ---------------------------------------------------------------- game IDs and squads
export const myProfiles = async () => (await call<{ items: Profile[] }>('GET', '/me/esports/profiles')).items;
export const mySquads = async () => (await call<{ items: Squad[] }>('GET', '/me/esports/squads')).items;

/** Screenshots go up as raw bytes first (no multipart); the key then goes with the profile or evidence. */
export async function uploadImage(uri: string, mime: 'image/jpeg' | 'image/png') {
  const bytes = await (await fetch(uri)).blob();
  return call<{ key: string }>('POST', '/me/esports/uploads', { raw: { bytes, type: mime } });
}

export const addProfile = (body: { gameId: string; uid: string; ign: string; screenshotKey: string }) => call<Profile>('POST', '/me/esports/profiles', { body });

// ---------------------------------------------------------------- entries
export const register = (tournamentId: string, body: { squadId?: string; players: string[]; substitutes?: string[] }, key: string) =>
  call<RegisterResult>('POST', `/esports/tournaments/${tournamentId}/registrations`, { body: { substitutes: [], ...body }, key });
export const myRegistrations = async () => (await call<{ items: Registration[] }>('GET', '/me/esports/registrations')).items;
export const acceptOffer = (id: string, key: string) => call<RegisterResult>('POST', `/me/esports/registrations/${id}/accept-offer`, { key });
export const withdraw = (id: string) => call<Registration & { refunded: { amount: number } }>('POST', `/me/esports/registrations/${id}/withdraw`);
export const checkIn = (id: string) => call<Registration & { checkedInPlayers: number }>('POST', `/me/esports/registrations/${id}/check-in`);

// ---------------------------------------------------------------- payments (M06)
export const startAttempt = (paymentId: string, method: 'bkash' | 'nagad' | 'card', key: string) =>
  call<{ attemptId: string; redirectUrl: string; expiresAt: string }>('POST', `/payments/${paymentId}/attempts`, { body: { method, returnTo: 'app' }, key });
export const verifyPayment = (paymentId: string) => call<{ status: string }>('POST', `/payments/${paymentId}/verify`);
export const getPayment = (paymentId: string) => call<{ id: string; status: string; amount: number; expiresAt: string; methods: string[]; title: string }>('GET', `/payments/${paymentId}`);

// ---------------------------------------------------------------- room and results
export type Room = { matchId: string; version: number; roomId: string; password: string; map: { key: string; nameEn: string; nameBn: string } | null; startsAt: string; revealedAt: string };
export const getRoom = (matchId: string) => call<Room>('GET', `/me/esports/matches/${matchId}/room`);

export type MatchResult = {
  id: string;
  tournamentId: string;
  seq: number;
  startsAt: string;
  status: string;
  resultsPostedAt: string | null;
  disputeClosesAt: string | null;
  results: { registrationId: string; entry: { name: string; tag: string | null; slotNo: number | null; players: { userId: string; ign: string }[] }; placement: number | null; kills: number; placementPoints: number; killPoints: number; totalPoints: number }[];
};
export const getMatch = (matchId: string) => call<MatchResult>('GET', `/esports/matches/${matchId}`);
export const addEvidence = (matchId: string, body: { kind: 'screenshot'; key: string; note?: string } | { kind: 'video_link'; url: string; note?: string }) =>
  call<{ id: string }>('POST', `/me/esports/matches/${matchId}/evidence`, { body });
export const openDispute = (matchId: string, body: { reason: string; evidenceIds: string[] }) => call<{ id: string; caseCode: string }>('POST', `/me/esports/matches/${matchId}/disputes`, { body });

// ---------------------------------------------------------------- rankings and players (M21-FR-27, FR-28)
export const leaderboard = (game: string, scope: 'rolling' | 'season', season?: string) =>
  call<Leaderboard>('GET', '/esports/leaderboards', { query: { game, scope, season: scope === 'season' ? season : undefined, limit: 100 } });
export const topPlayers = async () => (await call<{ items: TopPlayer[] }>('GET', '/esports/top-players')).items;
export const playerPage = (handle: string) => call<PlayerPage>('GET', `/esports/players/${encodeURIComponent(handle)}`);

// ---------------------------------------------------------------- squads (M21-FR-05)
export const createSquad = (body: { gameId: string; name: string; tag: string }) => call<Squad & { inviteCode: string | null }>('POST', '/me/esports/squads', { body });
export const joinSquad = (code: string) => call<Squad>('POST', '/me/esports/squads/join', { body: { code } });
export const inviteToSquad = (squadId: string, username: string) => call<Squad>('POST', `/me/esports/squads/${squadId}/invites`, { body: { username } });
export const acceptInvite = (memberId: string) => call<Squad>('POST', `/me/esports/squad-invites/${memberId}/accept`);
export const declineInvite = (memberId: string) => call<Squad>('POST', `/me/esports/squad-invites/${memberId}/decline`);
export const leaveSquad = (squadId: string) => call<{ left: boolean; squadStatus: string }>('POST', `/me/esports/squads/${squadId}/leave`);
export const removeMember = (squadId: string, userId: string) => call<Squad>('DELETE', `/me/esports/squads/${squadId}/members/${userId}`);
export const makeCaptain = (squadId: string, userId: string) => call<Squad>('POST', `/me/esports/squads/${squadId}/captain`, { body: { userId } });
export const setPrizeSplit = (registrationId: string, split: { userId: string; pct: number }[]) =>
  call<Registration>('PUT', `/me/esports/registrations/${registrationId}/prize-split`, { body: { split } });

// ---------------------------------------------------------------- winnings and withdrawals (M21-FR-25, M07)
export const winnings = () => call<Winnings>('GET', '/me/esports/winnings');
export const withdrawable = () => call<Withdrawable>('GET', '/me/withdrawals/available');
export const myWithdrawals = async () => (await call<{ items: Withdrawal[] }>('GET', '/me/withdrawals')).items;
export const withdrawNow = (key: string) => call<{ id: string; code: string; amount: number; status: string }>('POST', '/me/withdrawals', { key });
export const gate = (action: string) => call<Gate>('GET', '/me/gate', { query: { action } });
export const payoutAccounts = async () => (await call<{ items: PayoutAccount[] }>('GET', '/me/payout-accounts')).items;
export const sendPayoutCode = () => call<{ sent: boolean; expiresInSeconds: number; resendInSeconds: number }>('POST', '/me/payout-accounts/otp');
export const addPayoutAccount = (body: { type: 'bkash' | 'nagad'; accountNo: string; accountName: string; code: string }) => call<PayoutAccount>('POST', '/me/payout-accounts', { body });

// ---------------------------------------------------------------- the bell (M08)
export type Notice = { id: string; code: string; category: string; title: string; body: string; link: string | null; readAt: string | null; createdAt: string };
export const listNotifications = (cursor?: string) => call<Page<Notice> & { unreadCount: number }>('GET', '/me/notifications', { query: { cursor, limit: 30 } });
export const unreadCount = async () => (await call<{ unreadCount: number }>('GET', '/me/notifications/unread-count')).unreadCount;
export const markAllRead = () => call<{ unreadCount: number }>('POST', '/me/notifications/read', { body: { all: true, before: new Date().toISOString() } });
export const markRead = (ids: string[]) => call<{ unreadCount: number }>('POST', '/me/notifications/read', { body: { ids } });
