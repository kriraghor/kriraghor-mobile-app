/**
 * Esports (M21) for the app: the shapes the API returns, and the pure rules the screens use to
 * decide what a player can do next. API calls live in esports-api.ts.
 * Money from esports endpoints is { amount: poisha, currency: 'BDT' }; times are ISO in UTC.
 */
export type Money = { amount: number; currency: 'BDT' | string };
export type Named = { id: string; key: string; nameEn: string; nameBn: string };

export type TournamentStatus = 'scheduled' | 'registration_open' | 'registration_closed' | 'check_in' | 'live' | 'results_pending' | 'finalised' | 'paid_out' | 'cancelled';
export type MatchStatus = 'scheduled' | 'room_ready' | 'room_revealed' | 'live' | 'results_pending' | 'disputed' | 'final' | 'cancelled';
export type RegistrationStatus = 'pending_payment' | 'confirmed' | 'checked_in' | 'waitlisted' | 'offered' | 'no_show' | 'withdrawn' | 'refunded' | 'disqualified' | 'cancelled';

export type TournamentCard = {
  id: string;
  slug: string;
  titleEn: string;
  titleBn: string;
  game: Named;
  mode: Named & { teamSize: number; maxSubs: number };
  tier: string;
  format: string;
  entryUnit: 'player' | 'squad';
  entryFee: Money;
  prizePool: Money;
  killReward: Money | null;
  maxSlots: number;
  minParticipants: number;
  slotsTaken: number;
  waitlist: number;
  registrationOpensAt: string;
  registrationClosesAt: string;
  startsAt: string;
  status: TournamentStatus;
  featured: boolean;
  entryPolicy: 'open' | 'invite';
  organiser: { id: string; slug: string; name: string } | null;
};

export type TournamentDetail = TournamentCard & {
  rulesMd: string | null;
  placementPoints: number[];
  killPoints: number;
  prizes: { place: number; amount: Money }[];
  stages: { id: string; seq: number; nameEn: string; nameBn: string; kind: string; checkinOpensAt: string | null; checkinClosesAt: string | null }[];
  matches: { id: string; stageId: string; seq: number; map: Named | null; startsAt: string; status: MatchStatus; resultsPostedAt: string | null; disputeClosesAt: string | null }[];
  cancelReason: string | null;
};

export type Game = { id: string; key: string; nameEn: string; nameBn: string; uidLabelEn: string; uidLabelBn: string; uidRegex: string; ignMaxLen: number };
export type Profile = { id: string; gameId: string; gameKey: string; uid: string; uidMasked: string; ign: string; status: 'pending' | 'verified' | 'rejected' | 'banned' | 'unlinked'; rejectReason: string | null };

export type Squad = {
  id: string;
  gameId: string;
  name: string;
  tag: string;
  captainUserId: string;
  myStatus: 'active' | 'invited';
  members: { id: string; userId: string; role: 'captain' | 'member'; status: 'active' | 'invited'; displayName: string; profileId: string | null; ign: string | null }[];
};

export type Registration = {
  id: string;
  tournamentId: string;
  registrantUserId: string;
  squadId: string | null;
  slotNo: number | null;
  status: RegistrationStatus;
  amount: Money;
  paymentId: string | null;
  holdExpiresAt: string | null;
  offerExpiresAt: string | null;
  waitlistPosition: number | null;
  tournament?: { id: string; slug: string; titleEn: string; titleBn: string; status: TournamentStatus; startsAt: string; entryUnit: 'player' | 'squad' };
  matches?: { id: string; seq: number; startsAt: string; status: MatchStatus }[];
};

export type RegisterResult = { registration: Registration; payment: { id: string; payUrl: string } | null; waitlisted: boolean };

// ---------------------------------------------------------------- list groups (the website's tabs)
export const STATUS_GROUPS = {
  open: ['registration_open'],
  upcoming: ['scheduled', 'registration_closed', 'check_in'],
  live: ['live', 'results_pending'],
  finished: ['finalised', 'paid_out'],
} as const satisfies Record<string, readonly TournamentStatus[]>;
export type StatusGroup = keyof typeof STATUS_GROUPS;

export const title = (t: { titleEn: string; titleBn: string }, lang: string) => (lang === 'bn' && t.titleBn ? t.titleBn : t.titleEn);
export const named = (n: { nameEn: string; nameBn: string } | null | undefined, lang: string) => (n ? (lang === 'bn' && n.nameBn ? n.nameBn : n.nameEn) : '');

// ---------------------------------------------------------------- what the detail page offers
export type EventCta =
  | { kind: 'register' }
  | { kind: 'waitlist' }
  | { kind: 'registered'; registration: Registration }
  | { kind: 'opens_later'; at: string }
  | { kind: 'closed' }
  | { kind: 'invite_only' };

/** The one main action on an event page, for this player. */
export function eventCta(t: Pick<TournamentCard, 'status' | 'maxSlots' | 'slotsTaken' | 'registrationOpensAt' | 'entryPolicy'>, mine: Registration | null): EventCta {
  const live: RegistrationStatus[] = ['pending_payment', 'confirmed', 'checked_in', 'waitlisted', 'offered'];
  if (mine && live.includes(mine.status)) return { kind: 'registered', registration: mine };
  if (t.status === 'scheduled') return { kind: 'opens_later', at: t.registrationOpensAt };
  if (t.status !== 'registration_open') return { kind: 'closed' };
  if (t.entryPolicy === 'invite') return { kind: 'invite_only' };
  return t.slotsTaken >= t.maxSlots ? { kind: 'waitlist' } : { kind: 'register' };
}

// ---------------------------------------------------------------- what My matches offers per entry
export type EntryAction = 'pay' | 'take_slot' | 'check_in' | 'room' | 'result' | 'withdraw';

/** Mirrors the website's My matches (MyMatches.tsx): which buttons an entry shows. */
export function entryActions(r: Registration): EntryAction[] {
  const out: EntryAction[] = [];
  const ts = r.tournament?.status;
  const match = currentMatch(r);
  if (r.status === 'pending_payment' && r.paymentId) out.push('pay');
  if (r.status === 'offered') out.push('take_slot');
  if (r.status === 'confirmed' && ts === 'check_in') out.push('check_in');
  if (match && (match.status === 'room_revealed' || match.status === 'live' || (r.status === 'checked_in' && match.status === 'room_ready'))) out.push('room');
  if (match && ['results_pending', 'disputed', 'final'].includes(match.status)) out.push('result');
  if (['pending_payment', 'confirmed', 'waitlisted', 'offered'].includes(r.status) && ts && ['registration_open', 'registration_closed', 'check_in'].includes(ts)) out.push('withdraw');
  return out;
}

/** The match that matters now: the first not finished, else the last one. */
export function currentMatch(r: Pick<Registration, 'matches'>) {
  const ms = [...(r.matches ?? [])].sort((a, b) => a.seq - b.seq);
  return ms.find((m) => !['final', 'cancelled'].includes(m.status)) ?? ms[ms.length - 1] ?? null;
}

/** Room ID and password appear `revealMinutes` before the match (esports.room_reveal_minutes, default 15). */
export const revealAt = (startsAt: string, revealMinutes = 15) => new Date(new Date(startsAt).getTime() - revealMinutes * 60000).toISOString();

/** Registration needs the tournament uuid (the slug only works for reading the detail). */
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
