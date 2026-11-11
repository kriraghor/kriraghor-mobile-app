import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type Scheme = 'light' | 'dark';

const Scope = createContext<Scheme | null>(null);

/**
 * A part of the app with a look of its own, whatever the phone's setting (UI v2, 11 Nov 2026): the
 * Esports section is dark-first, like the esports website. Everything inside reads its colours through
 * `useTheme`, so wrapping a section's layout is enough; nothing inside needs to know.
 */
export function ThemeScope({ scheme, children }: { scheme: Scheme; children: ReactNode }) {
  return <Scope.Provider value={scheme}>{children}</Scope.Provider>;
}

/** The scheme to draw with here: the enclosing scope's, else the phone's (light when it does not say). */
export function useScheme(): Scheme {
  const scoped = useContext(Scope);
  const system = useColorScheme();
  return scoped ?? (system === 'dark' ? 'dark' : 'light');
}
