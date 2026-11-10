import { linkToRoute, type LinkTarget } from '../links';

jest.mock('expo-constants', () => ({ expoConfig: { extra: { gymUrl: 'https://gym.kriraghor.com/' } } }));

const M = '0192f0a4-1111-7aaa-8bbb-123456789abc'; // a match, member or assignment id
const G = 'https://gym.kriraghor.com';
const GYM_ID = '0192f0a4-2222-7aaa-8bbb-123456789abc';
const ext = (path: string): LinkTarget => ({ external: `${G}${path}` });

/** [template, link, where the tap goes]: every M24 §11.2 template and the M20 pass and subscription notices. */
const GYM_TEMPLATES: [string, string, LinkTarget][] = [
  // M24 member notices: the app's gym screens (M24-FR-105).
  ['GYM_LINK_INVITE', `${G}/me/requests`, '/gym/requests'],
  ['GYM_JOIN_ACCEPTED', `${G}/me/memberships/${M}`, `/gym/${M}`],
  ['GYM_MEMBERSHIP_STARTED', `${G}/me/memberships/${M}`, `/gym/${M}`],
  ['GYM_RENEWAL_DUE (no link)', `${G}/me/memberships/${M}`, `/gym/${M}`],
  ['GYM_MEMBERSHIP_ENDS_TODAY', `${G}/me/memberships/${M}`, `/gym/${M}`],
  ['GYM_MEMBERSHIP_EXPIRED', `${G}/me/memberships/${M}`, `/gym/${M}`],
  ['GYM_MEMBERSHIP_FROZEN', `${G}/me/memberships/${M}`, `/gym/${M}`],
  ['GYM_FEE_OVERDUE (no link)', `${G}/me/dues`, '/gym'],
  ['GYM_PAY_LINK', `${G}/me/dues`, '/gym'],
  ['GYM_PLAN_ASSIGNED', `${G}/me/plans/${M}`, `/gym/plans/${M}`],
  ['GYM_PLAN_UPDATED', `${G}/me/plans/${M}`, `/gym/plans/${M}`],
  // M24 member links the web gives a page of its own: pay links and receipts open in the browser.
  ['GYM_RENEWAL_DUE (pay link)', `${G}/p/tok_7KQ2abc`, ext('/p/tok_7KQ2abc')],
  ['GYM_FEE_OVERDUE (pay link)', `${G}/p/tok_7KQ2abc`, ext('/p/tok_7KQ2abc')],
  ['GYM_FEE_RECEIPT', `${G}/r/rcpt_9XYZ`, ext('/r/rcpt_9XYZ')],
  ['GYM_FEE_REVERSED', `${G}/r/rcpt_9XYZ`, ext('/r/rcpt_9XYZ')],
  ['GYM_JOIN_DECLINED', `${G}/gyms`, ext('/gyms')],
  // M24 owner and staff notices: the web panel (no owner screens in the app).
  ['GYM_JOIN_REQUEST_NEW', `${G}/manage/${GYM_ID}/requests`, ext(`/manage/${GYM_ID}/requests`)],
  ['GYM_LINK_ACCEPTED', `${G}/manage/${GYM_ID}/members/${M}`, ext(`/manage/${GYM_ID}/members/${M}`)],
  ['GYM_ONLINE_FEE_PAID', `${G}/manage/${GYM_ID}/members/${M}`, ext(`/manage/${GYM_ID}/members/${M}`)],
  ['GYM_OWNER_MORNING', `${G}/manage/${GYM_ID}`, ext(`/manage/${GYM_ID}`)],
  ['GYM_OWNER_MONTHLY_REPORT', `${G}/manage/${GYM_ID}/reports?month=2026-10`, ext(`/manage/${GYM_ID}/reports?month=2026-10`)],
  ['GYM_TIER_LIMIT_NEAR', `${G}/manage/billing`, ext('/manage/billing')],
  ['GYM_INVOICE_ISSUED', `${G}/manage/billing/invoices/${M}`, ext(`/manage/billing/invoices/${M}`)],
  ['GYM_INVOICE_DUE_SOON', `${G}/manage/billing/invoices/${M}`, ext(`/manage/billing/invoices/${M}`)],
  ['GYM_INVOICE_OVERDUE', `${G}/manage/billing/invoices/${M}`, ext(`/manage/billing/invoices/${M}`)],
  ['GYM_INVOICE_PAID', `${G}/manage/billing`, ext('/manage/billing')],
  ['GYM_ACCOUNT_RESTRICTED', `${G}/manage/billing`, ext('/manage/billing')],
  ['GYM_ACCOUNT_RESTORED', `${G}/manage`, ext('/manage')],
  ['GYM_FEE_OVERRIDE_SET', `${G}/manage/billing`, ext('/manage/billing')],
  ['GYM_SMS_BALANCE_LOW', `${G}/manage/billing`, ext('/manage/billing')],
  ['GYM_SMS_DEPLETED', `${G}/manage/billing`, ext('/manage/billing')],
  ['GYM_IMPORT_READY', `${G}/manage/${GYM_ID}/import`, ext(`/manage/${GYM_ID}/import`)],
  // M20 passes and trainer subscriptions (gym.kriraghor.com since M24 prompt 0).
  ['GYM_PASS_READY', `${G}/me/passes/GP-7KQ2`, '/gym/passes?code=GP-7KQ2'],
  ['GYM_PASS_CANCELLED', `${G}/me/passes`, '/gym/passes'],
  ['TRAINER_SUB_STARTED', `${G}/me/subscriptions`, '/gym/subscriptions'],
  ['TRAINER_SUB_RENEWAL_DUE', `${G}/me/subscriptions`, '/gym/subscriptions'],
  ['TRAINER_SUB_LAPSED (member)', `${G}/me/subscriptions`, '/gym/subscriptions'],
  // The trainer's side stays on kriraghor.com, which the app has no screen for.
  ['TRAINER_SUB_LAPSED (trainer)', 'https://kriraghor.com/pro/subscriptions', '/notifications'],
  ['TRAINER_NEW_SUBSCRIBER', '/pro/subscriptions', '/notifications'],
  ['TRAINER_SUB_PAID', '/me/payouts', '/notifications'],
];

describe('gym notification links (M24 §11.2, M20)', () => {
  it.each(GYM_TEMPLATES)('%s: %s', (_code, link, to) => {
    expect(linkToRoute(link)).toEqual(to);
  });
});

/** Gym member pages on the gym host, and the same paths when they arrive relative. */
const GYM_PAGES: [string, LinkTarget, LinkTarget][] = [
  // path, on the gym host, relative
  ['/me', '/gym', '/notifications'], // a relative /me is kriraghor.com's account page (escrow, team notices)
  ['/me/dues', '/gym', '/gym'],
  ['/me/memberships', '/gym', '/gym'],
  [`/me/memberships/${M}`, `/gym/${M}`, `/gym/${M}`],
  ['/me/requests', '/gym/requests', '/gym/requests'],
  ['/me/plans', '/gym', '/gym'],
  [`/me/plans/${M}`, `/gym/plans/${M}`, `/gym/plans/${M}`],
  ['/me/checkin', '/gym/checkin', '/gym/checkin'],
  ['/me/classes', '/gym/classes', '/gym/classes'], // M27 class notices
  ['/me/visits', '/gym/visits', '/gym/visits'], // M24 §17 visit notices
  [`/manage/${M}/my-work`, `/gym/work?g=${M}`, `/gym/work?g=${M}`], // a staff member's payslip notice
  ['/me/passes', '/gym/passes', '/gym/passes'],
  ['/me/passes/GP-7KQ2', '/gym/passes?code=GP-7KQ2', '/gym/passes?code=GP-7KQ2'],
  ['/me/subscriptions', '/gym/subscriptions', '/gym/subscriptions'],
  [`/me/subscriptions/${M}`, '/gym/subscriptions', '/gym/subscriptions'],
  // No screen in the app: the gym host opens the page, a relative path falls back to the list.
  ['/me/receipts', ext('/me/receipts'), '/notifications'],
  [`/me/memberships/not-a-uuid`, ext('/me/memberships/not-a-uuid'), '/notifications'],
  ['/trainers', ext('/trainers'), '/notifications'],
  ['/p/tok_7KQ2abc', ext('/p/tok_7KQ2abc'), '/ranks/tok_7KQ2abc'], // relative /p/… is an esports profile
  ['/manage', ext('/manage'), ext('/manage')],
  [`/manage/${M}/desk`, ext(`/manage/${M}/desk`), ext(`/manage/${M}/desk`)],
  ['/gyms/iron-house', ext('/gyms/iron-house'), ext('/gyms/iron-house')],
];

describe('gym member pages open the app screens', () => {
  it.each(GYM_PAGES)('%s', (path, onGym, relative) => {
    expect(linkToRoute(`${G}${path}`)).toEqual(onGym);
    expect(linkToRoute(path)).toEqual(relative);
  });

  it('with a language prefix, a trailing slash or a query', () => {
    expect(linkToRoute(`${G}/bn/me/requests/`)).toBe('/gym/requests');
    expect(linkToRoute(`/en/me/plans/${M}`)).toBe(`/gym/plans/${M}`);
    expect(linkToRoute(`${G}/me/checkin?e=v1.ge.abc.123.sig`)).toBe('/gym/checkin');
    expect(linkToRoute(`${G}/bn/gyms/iron-house?ref=push`)).toEqual(ext('/gyms/iron-house?ref=push'));
    expect(linkToRoute(`${G}/`)).toEqual({ external: G });
  });

  it('gym hosts of other environments and the build profile’s gym URL', () => {
    expect(linkToRoute(`https://gym.staging.kriraghor.com/me/memberships/${M}`)).toBe(`/gym/${M}`);
    expect(linkToRoute('http://gym.kriraghor.localhost/me')).toBe('/gym');
    expect(linkToRoute('https://gym.staging.kriraghor.com/manage')).toEqual(ext('/manage'));
    const dev = 'http://10.0.2.2:3003';
    expect(linkToRoute('http://10.0.2.2:3003/me/requests', dev)).toBe('/gym/requests');
    expect(linkToRoute('http://10.0.2.2:3003/r/abc', dev)).toEqual({ external: `${dev}/r/abc` });
    expect(linkToRoute('https://gym.kriraghor.com/gyms', `${dev}/`)).toEqual({ external: `${dev}/gyms` });
  });

  it('old kriraghor.com pass and subscription links (moved to the gym app) still open the gym screens', () => {
    expect(linkToRoute('https://kriraghor.com/me/passes')).toBe('/gym/passes');
    expect(linkToRoute('https://kriraghor.com/bn/me/passes/GP-7KQ2')).toBe('/gym/passes?code=GP-7KQ2');
    expect(linkToRoute('https://kriraghor.com/me/subscriptions')).toBe('/gym/subscriptions');
  });

  it('gym member paths on other hosts are not gym pages', () => {
    expect(linkToRoute('https://kriraghor.com/me')).toBe('/notifications');
    expect(linkToRoute('https://kriraghor.com/me/requests')).toBe('/notifications');
    expect(linkToRoute(`https://esports.kriraghor.com/me/plans/${M}`)).toBe('/notifications');
  });
});

describe('esports and kriraghor.com links keep working', () => {
  it('room and result links from the esports website', () => {
    expect(linkToRoute(`https://esports.kriraghor.com/me/matches/${M}/room`)).toBe(`/room/${M}`);
    expect(linkToRoute(`https://esports.kriraghor.com/me/matches/${M}/result`)).toBe(`/result/${M}`);
    expect(linkToRoute('https://esports.kriraghor.com/me/matches')).toBe('/matches');
    expect(linkToRoute('https://esports.kriraghor.com/me/matches/')).toBe('/matches');
    expect(linkToRoute('/me/matches')).toBe('/matches');
  });

  it('events by slug or id, with or without a language prefix', () => {
    expect(linkToRoute('https://esports.kriraghor.com/events/ff-daily-abc123')).toBe('/events/ff-daily-abc123');
    expect(linkToRoute('https://esports.kriraghor.com/bn/tournaments/ff-daily-abc123')).toBe('/events/ff-daily-abc123');
    expect(linkToRoute(`/en/me/matches/${M}/room`)).toBe(`/room/${M}`);
  });

  it('the tournament feed opens on kriraghor.com, not as an esports event (M26)', () => {
    expect(linkToRoute('/tournaments/mirpur-cup-97268976')).toEqual({ external: expect.stringMatching(/\/tournaments\/mirpur-cup-97268976$/) });
    expect(linkToRoute('/me/tournaments?thread=abc')).toEqual({ external: expect.stringMatching(/\/me\/tournaments\?thread=abc$/) });
    expect(linkToRoute('https://kriraghor.com/tournaments/mirpur-cup-97268976')).toEqual({ external: expect.stringMatching(/\/tournaments\/mirpur-cup-97268976$/) });
  });

  it('winnings, squads, the payout account and player pages (decided by host: /p/ is a profile off the gym host)', () => {
    expect(linkToRoute('https://esports.kriraghor.com/me/winnings')).toBe('/winnings');
    expect(linkToRoute('https://esports.kriraghor.com/me/esports/squads')).toBe('/squads');
    expect(linkToRoute('https://kriraghor.com/me/payout-account')).toBe('/payout-account');
    expect(linkToRoute('https://esports.kriraghor.com/bn/p/rafi.ff')).toBe('/ranks/rafi.ff');
    expect(linkToRoute('/p/rafi.ff')).toBe('/ranks/rafi.ff');
    expect(linkToRoute(`${G}/p/rafi.ff`)).toEqual(ext('/p/rafi.ff'));
  });

  it('look-alike paths and hosts are not gym links', () => {
    expect(linkToRoute('/me/passesx')).toBe('/notifications');
    expect(linkToRoute('/me/requestsx')).toBe('/notifications');
    expect(linkToRoute('/managers')).toBe('/notifications');
    expect(linkToRoute('/gym')).toBe('/notifications');
    expect(linkToRoute('https://gymkriraghor.com/me/payments')).toBe('/notifications');
    expect(linkToRoute('https://gymkriraghor.com/me/requests')).toBe('/notifications');
    expect(linkToRoute('https://kriraghor.com/pro/subscriptions')).toBe('/notifications');
  });

  it('anything else, or nothing, opens the notifications list', () => {
    expect(linkToRoute('/account')).toBe('/notifications');
    expect(linkToRoute('https://kriraghor.com/me/payments')).toBe('/notifications');
    expect(linkToRoute('/me/payouts')).toBe('/notifications');
    expect(linkToRoute(null)).toBe('/notifications');
    expect(linkToRoute('')).toBe('/notifications');
    expect(linkToRoute('/me/matches/not-a-uuid/room')).toBe('/notifications');
  });
});
