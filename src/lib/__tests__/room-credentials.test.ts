import { acceptCredentials, clearCredentials, credentialsFor, onCredentialsChange } from '../room-credentials';

beforeEach(clearCredentials);

describe('room credentials (M21-FR-15 to FR-17)', () => {
  it('keeps the first reveal and drops the same version arriving again (socket and API, edge case 22)', () => {
    const seen: string[] = [];
    const off = onCredentialsChange((id) => seen.push(id));
    expect(acceptCredentials({ matchId: 'm1', version: 1, roomId: '123456', password: 'kg42' })).toBe(true);
    expect(acceptCredentials({ matchId: 'm1', version: 1, roomId: '123456', password: 'kg42' })).toBe(false);
    expect(seen).toEqual(['m1']);
    off();
  });

  it('a rotation (higher version) replaces the pair; an older one never comes back', () => {
    acceptCredentials({ matchId: 'm1', version: 1, roomId: 'old', password: 'old' });
    expect(acceptCredentials({ matchId: 'm1', version: 2, roomId: 'new', password: 'new' })).toBe(true);
    expect(acceptCredentials({ matchId: 'm1', version: 1, roomId: 'old', password: 'old' })).toBe(false);
    expect(credentialsFor('m1')).toEqual({ matchId: 'm1', version: 2, roomId: 'new', password: 'new' });
  });

  it('matches are separate, and signing out clears them all', () => {
    acceptCredentials({ matchId: 'm1', version: 1, roomId: 'a', password: 'a' });
    acceptCredentials({ matchId: 'm2', version: 1, roomId: 'b', password: 'b' });
    expect(credentialsFor('m2')?.roomId).toBe('b');
    clearCredentials();
    expect(credentialsFor('m1')).toBeNull();
    expect(credentialsFor('m2')).toBeNull();
  });

  it('keeps only the four fields: nothing else from a payload is held', () => {
    acceptCredentials({ matchId: 'm1', version: 3, roomId: 'r', password: 'p', extra: 'x' } as never);
    expect(Object.keys(credentialsFor('m1') ?? {}).sort()).toEqual(['matchId', 'password', 'roomId', 'version']);
  });
});
