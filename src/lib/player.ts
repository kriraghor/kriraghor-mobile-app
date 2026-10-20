/**
 * The player side of esports (M21 part 2, M07 payouts): shapes and the pure rules the screens use.
 * Esports money is { amount: poisha }; withdrawals and payout objects use bare poisha.
 */
import type { Money, Registration } from './esports';

export type LeaderRow = { rank: number; userId: string; username: string | null; displayName: string; ign: string | null; points: number; tournaments: number };
export type Leaderboard = { game: { id: string; key: string; nameEn: string; nameBn: string }; scope: 'rolling' | 'season'; seasonKey: string; seasons: string[]; items: LeaderRow[] };
export type TopPlayer = { rank: number; userId: string; username: string | null; displayName: string; game: { key: string; nameEn: string; nameBn?: string }; points: number };
export type PlayerPage = {
  userId: string;
  username: string | null;
  displayName: string;
  tournaments: number;
  wins: number;
  kills: number;
  games: { game: { key: string; nameEn: string; nameBn: string }; ign: string | null; uidMasked: string; rank: number | null; points: number; tournaments: number; wins: number; kills: number }[];
};

export type Winnings = {
  available: Money;
  minimum: Money;
  dailyLimitLeft: Money;
  totalWon: Money;
  items: { id: string; tournament: { id: string; slug: string; titleEn: string; titleBn: string }; kind: 'place' | 'kill_reward'; place: number | null; amount: Money; status: 'pending' | 'credited' | 'reversed'; createdAt: string }[];
};
export type Withdrawable = { amount: number; withdrawable: number; dailyLeft: number; minimum: number };
export type Withdrawal = { id: string; code: string; amount: number; status: 'scheduled' | 'needs_approval' | 'on_hold' | 'processing' | 'paid' | 'failed' | 'cancelled'; createdAt: string; paidAt: string | null };
export type PayoutAccount = { id: string; type: 'bkash' | 'nagad'; masked: string; accountName: string; status: 'pending_verification' | 'active' | 'rejected' | 'superseded' | 'disabled'; reviewNote: string | null; holdUntil: string | null; createdAt: string };
export type Gate = { action: string; allowed: boolean; code?: string; next?: string };

/** Points are decimals (recency decay); one decimal is enough to tell players apart. */
export const points = (p: number) => (Math.round(p * 10) / 10).toFixed(1).replace(/\.0$/, '');

/** Dhaka quarters: 2026-S4 → "2026 · Oct–Dec". */
export function seasonLabel(key: string, lang: string): string {
  const m = /^(\d{4})-S([1-4])$/.exec(key);
  if (!m) return key;
  const q = Number(m[2]);
  const en = ['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec'][q - 1];
  const bn = ['জানু–মার্চ', 'এপ্রি–জুন', 'জুলাই–সেপ্টে', 'অক্টো–ডিসে'][q - 1];
  return `${m[1]} · ${lang === 'bn' ? bn : en}`;
}

// ---------------------------------------------------------------- prize split (M21 §6.5)
export type SplitRow = { userId: string; pct: number };

/** The players a split must list: every non-substitute player of the entry, once. */
export const splitPlayers = (r: Pick<Registration, 'players'>) => (r.players ?? []).filter((p) => !p.isSubstitute);

/** Equal shares in whole percents; the rounding remainder goes to the first listed (the captain registered first). */
export function equalSplit(userIds: string[]): SplitRow[] {
  if (!userIds.length) return [];
  const base = Math.floor(100 / userIds.length);
  const rest = 100 - base * userIds.length;
  return userIds.map((userId, i) => ({ userId, pct: base + (i === 0 ? rest : 0) }));
}

export type SplitCheck = { ok: true } | { ok: false; reason: 'sum' | 'range' | 'players' };

/** Same rules as the server (SPLIT_INVALID): whole percents 0–100, every player once, summing to 100. */
export function checkSplit(split: SplitRow[], playerIds: string[]): SplitCheck {
  if (split.some((s) => !Number.isInteger(s.pct) || s.pct < 0 || s.pct > 100)) return { ok: false, reason: 'range' };
  const ids = split.map((s) => s.userId);
  if (ids.length !== playerIds.length || new Set(ids).size !== ids.length || !playerIds.every((p) => ids.includes(p))) return { ok: false, reason: 'players' };
  if (split.reduce((n, s) => n + s.pct, 0) !== 100) return { ok: false, reason: 'sum' };
  return { ok: true };
}

/** Whether this player may set the entry's split now: squad entries, registered by them, before the event starts. */
export function canSplit(r: Registration, myUserId: string | undefined, now = Date.now()): boolean {
  return (
    !!myUserId &&
    r.registrantUserId === myUserId &&
    r.tournament?.entryUnit === 'squad' &&
    ['pending_payment', 'confirmed', 'checked_in'].includes(r.status) &&
    !!r.tournament?.startsAt &&
    now < Date.parse(r.tournament.startsAt)
  );
}

// ---------------------------------------------------------------- withdrawing (M21-FR-25, M07)
export type WithdrawState =
  | { kind: 'ready'; amount: number }
  | { kind: 'kyc'; pending: boolean }
  | { kind: 'account_missing' }
  | { kind: 'account_pending' }
  | { kind: 'below_minimum'; minimum: number }
  | { kind: 'daily_limit' }
  | { kind: 'nothing' }
  | { kind: 'open' };

/**
 * What the Withdraw button does, from the gate (NID KYC), the payout account, what is withdrawable
 * now and any open withdrawal. The server checks all of it again; this only explains it up front.
 */
export function withdrawState(input: { gate: Gate | null; accounts: PayoutAccount[]; available: Withdrawable | null; open: boolean }): WithdrawState {
  const { gate, accounts, available, open } = input;
  if (gate && !gate.allowed && (gate.code === 'KYC_REQUIRED' || gate.code === 'KYC_PENDING')) return { kind: 'kyc', pending: gate.code === 'KYC_PENDING' };
  if (open) return { kind: 'open' };
  if (!available || available.amount <= 0) return { kind: 'nothing' };
  if (!accounts.some((a) => a.status === 'active')) return accounts.some((a) => a.status === 'pending_verification') ? { kind: 'account_pending' } : { kind: 'account_missing' };
  if (available.withdrawable <= 0) return available.dailyLeft <= 0 ? { kind: 'daily_limit' } : { kind: 'below_minimum', minimum: available.minimum };
  if (available.withdrawable < available.minimum) return { kind: 'below_minimum', minimum: available.minimum };
  return { kind: 'ready', amount: available.withdrawable };
}

export const OPEN_WITHDRAWALS: Withdrawal['status'][] = ['scheduled', 'needs_approval', 'on_hold', 'processing'];

/** bKash and Nagad numbers: 01 then 3–9 then 8 digits (+880 or 880 accepted and normalised). */
export function normaliseWallet(input: string): string | null {
  const d = input.replace(/[\s-]/g, '').replace(/^\+?880/, '0');
  return /^01[3-9]\d{8}$/.test(d) ? d : null;
}
