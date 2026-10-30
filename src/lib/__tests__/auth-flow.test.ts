import {
  afterSignIn,
  authError,
  authOutcome,
  cleanCode,
  codeTarget,
  codeTargetKind,
  identifierKind,
  maskTarget,
  normalizePhone,
  normalizeUsername,
  passwordProblem,
  resendLeft,
  signupReady,
  usernameState,
} from '../auth-flow';

/** M01 sign-in on the app, the same rules as kriraghor.com (packages/ui auth/flow.ts). */
describe('normalizePhone', () => {
  it.each([
    ['01712345678', '+8801712345678'],
    ['8801712345678', '+8801712345678'],
    ['+880 1712-345678', '+8801712345678'],
    ['+880 (17) 1234 5678', '+8801712345678'],
    ['1712345678', '+8801712345678'],
    ['01912345678', '+8801912345678'],
  ])('%s → %s', (input, out) => expect(normalizePhone(input)).toBe(out));

  it.each(['01212345678', '0171234567', '017123456789', 'abc', '', '+44 7700 900123'])('rejects %p', (input) => expect(normalizePhone(input)).toBeNull());
});

describe('normalizeUsername', () => {
  it('lower-cases, trims and drops a leading @', () => {
    expect(normalizeUsername('  @Rafi.FF ')).toBe('rafi.ff');
    expect(normalizeUsername('abc')).toBe('abc');
    expect(normalizeUsername('a_b.c9')).toBe('a_b.c9');
  });

  it.each(['ab', '9abc', '_abc', 'abc.', 'a..b', 'a b c', 'abc-d', 'a'.repeat(31), ''])('rejects %p', (input) => expect(normalizeUsername(input)).toBeNull());

  it('allows 30 characters', () => expect(normalizeUsername('a'.repeat(30))).toBe('a'.repeat(30)));
});

describe('identifier kinds', () => {
  it('a code goes to a phone or an email', () => {
    expect(codeTargetKind(' 01712345678 ')).toBe('phone');
    expect(codeTargetKind('rafi@example.com')).toBe('email');
    expect(codeTargetKind('rafi@example')).toBeNull();
    expect(codeTargetKind('rafi.ff')).toBeNull();
  });

  it('a password sign-in also takes a username', () => {
    expect(identifierKind('01712345678')).toBe('phone');
    expect(identifierKind('rafi@example.com')).toBe('email');
    expect(identifierKind('@Rafi.ff')).toBe('username');
    expect(identifierKind('x')).toBeNull();
  });

  it('the target sent for a code: +880 phone or the trimmed email', () => {
    expect(codeTarget(' 017-1234-5678 ')).toBe('+8801712345678');
    expect(codeTarget(' rafi@example.com ')).toBe('rafi@example.com');
    expect(codeTarget('rafi')).toBeNull();
  });
});

describe('maskTarget', () => {
  it('shows only the start and end of a phone, and the start of an email', () => {
    expect(maskTarget('01712345678')).toBe('0171•••5678');
    expect(maskTarget('+8801912345678')).toBe('0191•••5678');
    expect(maskTarget('rafi@gmail.com')).toBe('ra•••@gmail.com');
  });

  it('leaves anything else as typed', () => expect(maskTarget(' rafi ')).toBe('rafi'));
});

describe('code entry and resend', () => {
  it('keeps the first six digits of a typed or pasted code', () => {
    expect(cleanCode('12 34-56')).toBe('123456');
    expect(cleanCode('1234567')).toBe('123456');
    expect(cleanCode('ab')).toBe('');
  });

  it('counts down from 60 seconds, never below zero', () => {
    expect(resendLeft(0, 0)).toBe(60);
    expect(resendLeft(0, 1_500)).toBe(59);
    expect(resendLeft(0, 60_000)).toBe(0);
    expect(resendLeft(0, 90_000)).toBe(0);
    expect(resendLeft(0, 10_000, 30)).toBe(20);
  });
});

describe('passwordProblem', () => {
  it('an optional password may be empty', () => expect(passwordProblem('', true)).toBeNull());
  it('a required one may not', () => expect(passwordProblem('', false)).toBe('short'));
  it('8 to 128 characters', () => {
    expect(passwordProblem('1234567', true)).toBe('short');
    expect(passwordProblem('12345678', false)).toBeNull();
    expect(passwordProblem('x'.repeat(128), false)).toBeNull();
    expect(passwordProblem('x'.repeat(129), false)).toBe('long');
  });
});

describe('authError: problem codes → our text and the step', () => {
  it('a wrong or locked password offers a code instead', () => {
    expect(authError({ code: 'INVALID_CREDENTIALS' })).toEqual({ key: 'INVALID_CREDENTIALS', offerCode: true });
    expect(authError({ code: 'AUTH_LOCKED', meta: { retryAfter: 900 } })).toEqual({ key: 'AUTH_LOCKED', offerCode: true });
  });

  it('too many codes: with the wait when the server gives it', () => {
    expect(authError({ code: 'OTP_RATE_LIMITED', meta: { retryAfter: 42.2 } })).toEqual({ key: 'OTP_RATE_LIMITED_WAIT', seconds: 43 });
    expect(authError({ code: 'OTP_COOLDOWN', meta: { retryAfter: 12 } })).toEqual({ key: 'OTP_RATE_LIMITED_WAIT', seconds: 12 });
    expect(authError({ code: 'OTP_RATE_LIMITED' })).toEqual({ key: 'OTP_RATE_LIMITED' });
    expect(authError({ code: 'OTP_RATE_LIMITED', meta: null })).toEqual({ key: 'OTP_RATE_LIMITED' });
    expect(authError({ code: 'OTP_RATE_LIMITED', meta: { retryAfter: 'soon' } })).toEqual({ key: 'OTP_RATE_LIMITED' });
    expect(authError({ code: 'OTP_RATE_LIMITED', meta: { retryAfter: 0 } })).toEqual({ key: 'OTP_RATE_LIMITED' });
  });

  it('an expired sign-up token goes back to the code step', () => {
    expect(authError({ code: 'SIGNUP_TOKEN_INVALID' })).toEqual({ key: 'SIGNUP_TOKEN_INVALID', step: 'code' });
  });

  it.each([
    ['STAFF_USE_ADMIN_PORTAL', 'STAFF_USE_ADMIN_PORTAL'],
    ['OTP_INVALID', 'OTP_INVALID'],
    ['OTP_EXPIRED', 'OTP_EXPIRED'],
    ['OTP_PURPOSE_INVALID', 'OTP_PURPOSE_INVALID'],
    ['USERNAME_TAKEN', 'USERNAME_TAKEN'],
    ['PASSWORD_WEAK', 'PASSWORD_WEAK'],
    ['PASSWORD_BREACHED', 'PASSWORD_BREACHED'],
    ['ACCOUNT_EXISTS', 'ACCOUNT_EXISTS'],
    ['ACCOUNT_SUSPENDED', 'ACCOUNT_BLOCKED'],
    ['ACCOUNT_BANNED', 'ACCOUNT_BLOCKED'],
    ['ACCOUNT_CLOSED', 'ACCOUNT_BLOCKED'],
    ['RATE_LIMITED', 'RATE_LIMITED'],
  ])('%s', (code, key) => expect(authError({ code })).toEqual({ key }));

  it('codes without a text of our own, or no problem, show the server title', () => {
    expect(authError({ code: 'VALIDATION_FAILED' })).toBeNull();
    expect(authError({ code: 42 })).toBeNull();
    expect(authError({})).toBeNull();
    expect(authError(null)).toBeNull();
    expect(authError(undefined)).toBeNull();
  });
});

describe('authOutcome', () => {
  const now = Date.parse('2026-10-30T10:00:00Z');

  it('signed in: the tokens', () => {
    expect(authOutcome({ status: 'signed_in', accessToken: 'a', refreshToken: 'r' })).toEqual({ kind: 'signed_in', tokens: { accessToken: 'a', refreshToken: 'r' } });
  });

  it('a new account: the token, its expiry and the suggested name', () => {
    expect(authOutcome({ status: 'signup', signupToken: 's', signupTokenExpiresAt: '2026-10-30T10:15:00Z', suggested: { displayName: 'Rafi', needsUsername: true } }, now)).toEqual({
      kind: 'signup',
      verified: { signupToken: 's', expiresAt: now + 15 * 60_000, displayName: 'Rafi', needsUsername: true },
    });
  });

  it('no expiry from the server: ten minutes; no suggestion: empty name', () => {
    expect(authOutcome({ status: 'signup', signupToken: 's' }, now)).toEqual({ kind: 'signup', verified: { signupToken: 's', expiresAt: now + 10 * 60_000, displayName: '', needsUsername: false } });
    expect(authOutcome({ status: 'signup', signupToken: 's', signupTokenExpiresAt: 'later', suggested: { displayName: null } }, now)).toEqual({
      kind: 'signup',
      verified: { signupToken: 's', expiresAt: now + 10 * 60_000, displayName: '', needsUsername: false },
    });
  });

  it('anything else is not usable', () => {
    expect(authOutcome({ status: 'signed_in' })).toEqual({ kind: 'unknown' });
    expect(authOutcome({ status: 'signup' })).toEqual({ kind: 'unknown' });
    expect(authOutcome(undefined)).toEqual({ kind: 'unknown' });
    expect(authOutcome(null)).toEqual({ kind: 'unknown' });
  });

  it('uses the clock when no time is given', () => {
    const out = authOutcome({ status: 'signup', signupToken: 's' });
    expect(out.kind === 'signup' && out.verified.expiresAt > Date.now()).toBe(true);
  });
});

describe('after sign-in', () => {
  it('goes back to where it was opened, else the hub', () => {
    expect(afterSignIn(true)).toBe('back');
    expect(afterSignIn(false)).toBe('/');
  });
});

describe('usernameState and signupReady', () => {
  it('empty, invalid, checking, error, free and taken', () => {
    expect(usernameState('  ', null)).toEqual({ state: 'empty' });
    expect(usernameState('ab', null)).toEqual({ state: 'invalid' });
    expect(usernameState('Rafi', null)).toEqual({ state: 'checking', username: 'rafi' });
    expect(usernameState('rafi', { for: 'rafi2', taken: false })).toEqual({ state: 'checking', username: 'rafi' });
    expect(usernameState('rafi', { for: 'rafi', error: true })).toEqual({ state: 'error', username: 'rafi' });
    expect(usernameState('rafi', { for: 'rafi', taken: false })).toEqual({ state: 'free', username: 'rafi' });
    expect(usernameState('rafi', { for: 'rafi', taken: true })).toEqual({ state: 'taken', username: 'rafi' });
  });

  const v = { displayName: 'Rafi Ahmed', username: '', password: '' };
  it('a name of 2 to 80 letters is enough', () => {
    expect(signupReady(v, { state: 'empty' }, false)).toBe(true);
    expect(signupReady({ ...v, displayName: ' R ' }, { state: 'empty' }, false)).toBe(false);
    expect(signupReady({ ...v, displayName: 'R'.repeat(81) }, { state: 'empty' }, false)).toBe(false);
  });

  it('a username must be free (or the check failed, the server decides)', () => {
    expect(signupReady(v, { state: 'free' }, false)).toBe(true);
    expect(signupReady(v, { state: 'error' }, false)).toBe(true);
    expect(signupReady(v, { state: 'taken' }, false)).toBe(false);
    expect(signupReady(v, { state: 'invalid' }, false)).toBe(false);
    expect(signupReady(v, { state: 'checking' }, false)).toBe(false);
  });

  it('when the account needs a username, only a free one', () => {
    expect(signupReady(v, { state: 'empty' }, true)).toBe(false);
    expect(signupReady(v, { state: 'free' }, true)).toBe(true);
  });

  it('an optional password of 8 or more', () => {
    expect(signupReady({ ...v, password: 'short' }, { state: 'empty' }, false)).toBe(false);
    expect(signupReady({ ...v, password: 'long enough' }, { state: 'empty' }, false)).toBe(true);
  });
});
