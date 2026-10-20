/**
 * Room ID and password (M21-FR-15 to FR-17). They live in memory only — never written to the phone,
 * never logged — and arrive twice for the same reveal (the socket event and the API read), so each
 * match keeps the highest version seen and drops anything older or equal (edge case 22). A rotation
 * comes with a higher version and replaces the old pair. Signing out clears everything.
 */
export type RoomCredentials = { matchId: string; version: number; roomId: string; password: string };

type Listener = (matchId: string) => void;

const byMatch = new Map<string, RoomCredentials>();
const listeners = new Set<Listener>();

/** Keep a newer version; returns true when it changed what the screen should show. */
export function acceptCredentials(c: RoomCredentials): boolean {
  const current = byMatch.get(c.matchId);
  if (current && current.version >= c.version) return false;
  byMatch.set(c.matchId, { matchId: c.matchId, version: c.version, roomId: c.roomId, password: c.password });
  for (const l of listeners) l(c.matchId);
  return true;
}

export const credentialsFor = (matchId: string): RoomCredentials | null => byMatch.get(matchId) ?? null;

export function onCredentialsChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearCredentials() {
  byMatch.clear();
  for (const l of listeners) l('*');
}
