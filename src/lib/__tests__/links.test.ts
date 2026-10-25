import { linkToRoute } from '../links';

jest.mock('expo-constants', () => ({ expoConfig: { extra: { gymUrl: 'https://gym.kriraghor.com/' } } }));

const M = '0192f0a4-1111-7aaa-8bbb-123456789abc';

describe('notification links open the right screen', () => {
  it('room and result links from the esports website', () => {
    expect(linkToRoute(`https://esports.kriraghor.com/me/matches/${M}/room`)).toBe(`/room/${M}`);
    expect(linkToRoute(`https://esports.kriraghor.com/me/matches/${M}/result`)).toBe(`/result/${M}`);
    expect(linkToRoute('https://esports.kriraghor.com/me/matches')).toBe('/matches');
    expect(linkToRoute('https://esports.kriraghor.com/me/matches/')).toBe('/matches');
  });

  it('events by slug or id, with or without a language prefix', () => {
    expect(linkToRoute('https://esports.kriraghor.com/events/ff-daily-abc123')).toBe('/events/ff-daily-abc123');
    expect(linkToRoute('https://esports.kriraghor.com/bn/tournaments/ff-daily-abc123')).toBe('/events/ff-daily-abc123');
    expect(linkToRoute(`/en/me/matches/${M}/room`)).toBe(`/room/${M}`);
  });

  it('winnings, squads, the payout account and player pages', () => {
    expect(linkToRoute('https://esports.kriraghor.com/me/winnings')).toBe('/winnings');
    expect(linkToRoute('https://esports.kriraghor.com/me/esports/squads')).toBe('/squads');
    expect(linkToRoute('https://kriraghor.com/me/payout-account')).toBe('/payout-account');
    expect(linkToRoute('https://esports.kriraghor.com/bn/p/rafi.ff')).toBe('/ranks/rafi.ff');
  });

  it('gym links open in the browser on the gym app (M24-FR-103)', () => {
    const G = 'https://gym.kriraghor.com';
    expect(linkToRoute(`${G}/me/passes/GP-7KQ2`)).toEqual({ external: `${G}/me/passes/GP-7KQ2` });
    expect(linkToRoute(`${G}/me/passes`)).toEqual({ external: `${G}/me/passes` });
    expect(linkToRoute(`${G}/me/subscriptions/`)).toEqual({ external: `${G}/me/subscriptions` });
    expect(linkToRoute(`${G}/manage/${M}/edit`)).toEqual({ external: `${G}/manage/${M}/edit` });
    expect(linkToRoute(`${G}/manage`)).toEqual({ external: `${G}/manage` });
    expect(linkToRoute(`${G}/bn/gyms/iron-house?ref=push`)).toEqual({ external: `${G}/gyms/iron-house?ref=push` });
    // Any page on the gym host, even one without a known gym path.
    expect(linkToRoute(`${G}/`)).toEqual({ external: G });
    expect(linkToRoute(`${G}/trainers`)).toEqual({ external: `${G}/trainers` });
  });

  it('gym links from other environments or relative gym paths open on the configured gym app', () => {
    const G = 'https://gym.kriraghor.com';
    expect(linkToRoute('https://gym.staging.kriraghor.com/me/passes')).toEqual({ external: `${G}/me/passes` });
    expect(linkToRoute('http://gym.kriraghor.localhost/manage')).toEqual({ external: `${G}/manage` });
    expect(linkToRoute('/me/passes/GP-7KQ2')).toEqual({ external: `${G}/me/passes/GP-7KQ2` });
    expect(linkToRoute('/me/subscriptions')).toEqual({ external: `${G}/me/subscriptions` });
    expect(linkToRoute('https://kriraghor.com/me/passes')).toEqual({ external: `${G}/me/passes` });
    expect(linkToRoute(`/manage/${M}/desk`)).toEqual({ external: `${G}/manage/${M}/desk` });
    expect(linkToRoute('/gyms/iron-house')).toEqual({ external: `${G}/gyms/iron-house` });
  });

  it('the gym URL comes from the build profile (dev emulator host)', () => {
    const dev = 'http://10.0.2.2:3003';
    expect(linkToRoute('http://10.0.2.2:3003/me/passes', dev)).toEqual({ external: `${dev}/me/passes` });
    expect(linkToRoute('https://gym.kriraghor.com/gyms', dev)).toEqual({ external: `${dev}/gyms` });
    expect(linkToRoute('/me/subscriptions', `${dev}/`)).toEqual({ external: `${dev}/me/subscriptions` });
  });

  it('look-alike paths and hosts are not gym links', () => {
    expect(linkToRoute('/me/passesx')).toBe('/notifications');
    expect(linkToRoute('/managers')).toBe('/notifications');
    expect(linkToRoute('/gym')).toBe('/notifications');
    expect(linkToRoute('https://gymkriraghor.com/me/payments')).toBe('/notifications');
    expect(linkToRoute('https://kriraghor.com/pro/subscriptions')).toBe('/notifications');
  });

  it('anything else, or nothing, opens the notifications list', () => {
    expect(linkToRoute('/account')).toBe('/notifications');
    expect(linkToRoute('https://kriraghor.com/me/payments')).toBe('/notifications');
    expect(linkToRoute(null)).toBe('/notifications');
    expect(linkToRoute('')).toBe('/notifications');
    expect(linkToRoute('/me/matches/not-a-uuid/room')).toBe('/notifications');
  });
});
