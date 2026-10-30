import { shouldCheck, shouldPrompt, UPDATE_CHECK_GAP_MS } from '../app-updates';

jest.mock('expo-updates', () => ({ isEnabled: false }));

describe('shouldCheck', () => {
  it('checks the first time', () => expect(shouldCheck(0, 1_000)).toBe(true));
  it('waits for the gap after a check', () => expect(shouldCheck(10_000, 10_000 + UPDATE_CHECK_GAP_MS - 1)).toBe(false));
  it('checks again once the gap has passed', () => expect(shouldCheck(10_000, 10_000 + UPDATE_CHECK_GAP_MS)).toBe(true));
  it('takes a custom gap', () => expect(shouldCheck(5, 15, 10)).toBe(true));
});

describe('shouldPrompt', () => {
  it('offers a new update once', () => expect(shouldPrompt(true, 'u1', null)).toBe(true));
  it('does not offer the same update twice', () => expect(shouldPrompt(true, 'u1', 'u1')).toBe(false));
  it('offers a newer update after an earlier one', () => expect(shouldPrompt(true, 'u2', 'u1')).toBe(true));
  it('skips an update that is not new', () => expect(shouldPrompt(false, 'u1', null)).toBe(false));
  it('skips an update without an id', () => expect(shouldPrompt(true, undefined, null)).toBe(false));
});
