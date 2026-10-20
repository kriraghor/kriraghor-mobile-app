import { linkToRoute } from '../links';

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

  it('anything else, or nothing, opens the notifications list', () => {
    expect(linkToRoute('/account')).toBe('/notifications');
    expect(linkToRoute('https://kriraghor.com/me/payments')).toBe('/notifications');
    expect(linkToRoute(null)).toBe('/notifications');
    expect(linkToRoute('')).toBe('/notifications');
    expect(linkToRoute('/me/matches/not-a-uuid/room')).toBe('/notifications');
  });
});
