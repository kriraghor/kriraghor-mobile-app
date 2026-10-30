/**
 * Sign-in and sign-up rules for the app (M01), ported from the websites' packages/ui auth/flow.ts so
 * the app and kriraghor.com behave the same: which kind of identifier was typed, the Bangladesh phone
 * form, the username rule, how a code target is shown back, and what each auth error code means for
 * the screen (a message, and sometimes a step to go back to). The server is the judge of every rule;
 * these only give early, friendly feedback. Pure, so they are unit-tested without a phone.
 */

export type IdentifierKind = 'phone' | 'email' | 'username';
export type CodeTargetKind = 'phone' | 'email';

/** The same normalisation as the backend (common/identifiers): 01…, 8801…, +880 1… → +8801…. */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/[\s\-()]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  if (d.startsWith('880')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  const e164 = `+880${d}`;
  return /^\+8801[3-9]\d{8}$/.test(e164) ? e164 : null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Username: 3–30 chars, starts with a letter, letters/digits/dot/underscore, no trailing or double dot (stored lower-case). */
export function normalizeUsername(input: string): string | null {
  const u = input.trim().toLowerCase().replace(/^@/, '');
  if (!/^[a-z][a-z0-9._]{2,29}$/.test(u) || u.endsWith('.') || u.includes('..')) return null;
  return u;
}

/** Where a code can go: a phone or an email; null when it is neither (shown before any request). */
export function codeTargetKind(input: string): CodeTargetKind | null {
  const v = input.trim();
  if (normalizePhone(v)) return 'phone';
  if (EMAIL.test(v)) return 'email';
  return null;
}

/** What the password step's "Mobile, email or username" field holds; null when it is none of them. */
export function identifierKind(input: string): IdentifierKind | null {
  return codeTargetKind(input) ?? (normalizeUsername(input) ? 'username' : null);
}

/** The target sent to /auth/otp/send and /verify: the phone in +880 form, an email trimmed; null when invalid. */
export function codeTarget(input: string): string | null {
  const v = input.trim();
  const phone = normalizePhone(v);
  if (phone) return phone;
  return EMAIL.test(v) ? v : null;
}

/** How the code step names where the code went: 0171•••5678, ra•••@gmail.com. */
export function maskTarget(input: string): string {
  const v = input.trim();
  const phone = normalizePhone(v);
  if (phone) return `0${phone.slice(4, 7)}•••${phone.slice(-4)}`;
  const [user, domain] = v.split('@');
  if (!domain) return v;
  return `${user.slice(0, 2)}•••@${domain}`;
}

export const CODE_LENGTH = 6;
/** The server's resend cooldown (otp.resendCooldownSeconds); the send answer's resendInSeconds wins when present. */
export const RESEND_SECONDS = 60;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const NAME_MIN = 2;
export const NAME_MAX = 80;

/** Only the digits of a typed or pasted code, at most six. */
export const cleanCode = (input: string) => input.replace(/\D/g, '').slice(0, CODE_LENGTH);

/** Seconds left before Resend, from when the code was sent. */
export function resendLeft(sentAt: number, now: number, seconds: number = RESEND_SECONDS): number {
  return Math.max(0, seconds - Math.floor((now - sentAt) / 1000));
}

/** A new password is acceptable to send: empty when optional, else 8–128 characters. */
export function passwordProblem(password: string, optional: boolean): 'short' | 'long' | null {
  if (!password) return optional ? null : 'short';
  if (password.length < PASSWORD_MIN) return 'short';
  if (password.length > PASSWORD_MAX) return 'long';
  return null;
}

export type Step = 'password' | 'code' | 'signup' | 'reset';

/** Error codes the auth screens explain in their own words (i18n `signIn.errors.*`). */
export type AuthErrorKey =
  | 'INVALID_CREDENTIALS'
  | 'AUTH_LOCKED'
  | 'STAFF_USE_ADMIN_PORTAL'
  | 'OTP_INVALID'
  | 'OTP_EXPIRED'
  | 'OTP_RATE_LIMITED'
  | 'OTP_RATE_LIMITED_WAIT'
  | 'OTP_PURPOSE_INVALID'
  | 'USERNAME_TAKEN'
  | 'PASSWORD_WEAK'
  | 'PASSWORD_BREACHED'
  | 'SIGNUP_TOKEN_INVALID'
  | 'ACCOUNT_EXISTS'
  | 'ACCOUNT_BLOCKED'
  | 'RATE_LIMITED';

export type AuthError = {
  key: AuthErrorKey;
  /** Seconds to wait, when the server said (meta.retryAfter). */
  seconds?: number;
  /** The step the screen moves to (a signup token that expired → verify again). */
  step?: Step;
  /** Offer "Get a code instead" next to the message (no password yet, or locked out). */
  offerCode?: boolean;
};

const KEYS: Record<string, AuthErrorKey> = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  AUTH_LOCKED: 'AUTH_LOCKED',
  STAFF_USE_ADMIN_PORTAL: 'STAFF_USE_ADMIN_PORTAL',
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_RATE_LIMITED: 'OTP_RATE_LIMITED',
  OTP_COOLDOWN: 'OTP_RATE_LIMITED',
  OTP_PURPOSE_INVALID: 'OTP_PURPOSE_INVALID',
  USERNAME_TAKEN: 'USERNAME_TAKEN',
  PASSWORD_WEAK: 'PASSWORD_WEAK',
  PASSWORD_BREACHED: 'PASSWORD_BREACHED',
  SIGNUP_TOKEN_INVALID: 'SIGNUP_TOKEN_INVALID',
  ACCOUNT_EXISTS: 'ACCOUNT_EXISTS',
  ACCOUNT_SUSPENDED: 'ACCOUNT_BLOCKED',
  ACCOUNT_BANNED: 'ACCOUNT_BLOCKED',
  ACCOUNT_CLOSED: 'ACCOUNT_BLOCKED',
  RATE_LIMITED: 'RATE_LIMITED',
};

export type ProblemLike = { code?: unknown; meta?: unknown } | null | undefined;

function retryAfter(meta: unknown): number | undefined {
  const s = (meta as { retryAfter?: unknown } | null | undefined)?.retryAfter;
  return typeof s === 'number' && Number.isFinite(s) && s > 0 ? Math.ceil(s) : undefined;
}

/**
 * A problem+json answer → what the screen says and does. Null for codes without a text of our own
 * (the screen shows the server's title, already in plain words).
 */
export function authError(problem: ProblemLike): AuthError | null {
  const code = typeof problem?.code === 'string' ? problem.code : undefined;
  const key = code ? KEYS[code] : undefined;
  if (!key) return null;
  switch (key) {
    case 'INVALID_CREDENTIALS':
    case 'AUTH_LOCKED':
      return { key, offerCode: true };
    case 'OTP_RATE_LIMITED': {
      const seconds = retryAfter(problem?.meta);
      return seconds ? { key: 'OTP_RATE_LIMITED_WAIT', seconds } : { key };
    }
    case 'SIGNUP_TOKEN_INVALID':
      return { key, step: 'code' };
    default:
      return { key };
  }
}

/** The body /auth/login, /otp/verify and /signup return. */
export type AuthBody =
  | {
      status?: string;
      accessToken?: string;
      refreshToken?: string;
      signupToken?: string;
      signupTokenExpiresAt?: string;
      suggested?: { displayName?: string | null; needsUsername?: boolean };
    }
  | null
  | undefined;

export type Verified = { signupToken: string; expiresAt: number; displayName: string; needsUsername: boolean };

/** What a verify (or login) answer means: signed in with tokens, a new account to finish, or nothing usable. */
export function authOutcome(
  body: AuthBody,
  now: number = Date.now()
): { kind: 'signed_in'; tokens: { accessToken: string; refreshToken?: string } } | { kind: 'signup'; verified: Verified } | { kind: 'unknown' } {
  if (body?.status === 'signed_in' && body.accessToken) return { kind: 'signed_in', tokens: { accessToken: body.accessToken, refreshToken: body.refreshToken } };
  if (body?.status === 'signup' && body.signupToken) {
    const exp = body.signupTokenExpiresAt ? Date.parse(body.signupTokenExpiresAt) : NaN;
    return {
      kind: 'signup',
      verified: {
        signupToken: body.signupToken,
        expiresAt: Number.isFinite(exp) ? exp : now + 10 * 60_000,
        displayName: body.suggested?.displayName ?? '',
        needsUsername: Boolean(body.suggested?.needsUsername),
      },
    };
  }
  return { kind: 'unknown' };
}

/** After signing in: back to where the sign-in was opened from, or the hub when nothing is underneath. */
export const afterSignIn = (canGoBack: boolean): 'back' | '/' => (canGoBack ? 'back' : '/');

export type UsernameCheck = { state: 'empty' | 'invalid' | 'checking' | 'free' | 'taken' | 'error'; username?: string };
export type UsernameResult = { for: string; taken: boolean } | { for: string; error: true } | null;

/** The username field's state from what was typed and the last availability answer. */
export function usernameState(raw: string, result: UsernameResult): UsernameCheck {
  const username = normalizeUsername(raw);
  if (!raw.trim()) return { state: 'empty' };
  if (!username) return { state: 'invalid' };
  if (!result || result.for !== username) return { state: 'checking', username };
  if ('error' in result) return { state: 'error', username };
  return { state: result.taken ? 'taken' : 'free', username };
}

/** Whether the sign-up form may be sent: a name, a usable username (or none), a password of 8+ (or none). */
export function signupReady(v: { displayName: string; username: string; password: string }, check: UsernameCheck, needsUsername: boolean): boolean {
  const name = v.displayName.trim();
  if (name.length < NAME_MIN || name.length > NAME_MAX) return false;
  if (check.state === 'invalid' || check.state === 'taken' || check.state === 'checking') return false;
  if (needsUsername && check.state !== 'free') return false;
  return passwordProblem(v.password, true) === null;
}
