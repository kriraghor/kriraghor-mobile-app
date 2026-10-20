import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import { clearSession, hasStoredSession, refresh, saveSession } from './session';

type Status = 'loading' | 'signed_in' | 'signed_out';
type Ctx = {
  status: Status;
  signedIn: (tokens: { accessToken: string; refreshToken?: string }) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

/** Restores the session at launch from the stored refresh token. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    (async () => {
      // Anything that goes wrong while restoring means signed out, never a stuck splash screen.
      const token = await hasStoredSession()
        .then((stored) => (stored ? refresh() : null))
        .catch(() => null);
      setStatus(token ? 'signed_in' : 'signed_out');
    })();
  }, []);

  const signedIn = useCallback(async (tokens: { accessToken: string; refreshToken?: string }) => {
    await saveSession(tokens);
    setStatus('signed_in');
  }, []);

  const signOut = useCallback(async () => {
    await api.POST('/auth/logout', {}).catch(() => undefined);
    await clearSession();
    setStatus('signed_out');
  }, []);

  const value = useMemo(() => ({ status, signedIn, signOut }), [status, signedIn, signOut]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
