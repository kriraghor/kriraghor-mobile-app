import { StatusBar } from 'expo-status-bar';
import { createContext, useContext, type ComponentType, type ReactNode } from 'react';
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

/**
 * An esports screen that lives outside the Esports tabs (register, the room, a result, winnings…): the
 * same dark look as the section, with the status bar's icons light. Its header is set dark in the root
 * stack (`src/app/_layout.tsx`), since the header is drawn outside the screen.
 */
export function inEsports<P extends object>(Screen: ComponentType<P>) {
  function EsportsScreen(props: P) {
    return (
      <ThemeScope scheme="dark">
        <StatusBar style="light" />
        <Screen {...props} />
      </ThemeScope>
    );
  }
  EsportsScreen.displayName = `inEsports(${Screen.displayName ?? Screen.name ?? 'Screen'})`;
  return EsportsScreen;
}

/** The scheme to draw with here: the enclosing scope's, else the phone's (light when it does not say). */
export function useScheme(): Scheme {
  const scoped = useContext(Scope);
  const system = useColorScheme();
  return scoped ?? (system === 'dark' ? 'dark' : 'light');
}
