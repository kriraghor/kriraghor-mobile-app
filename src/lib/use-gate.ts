import { router } from 'expo-router';
import { useCallback } from 'react';
import { useAuth } from './auth';
import { deferUntilSignedIn, needsSignIn, type Action } from './guest';

/**
 * `gate(action, run)`: runs the action now when it is open to guests or the person is signed in;
 * otherwise opens the sign-in modal and runs it once they are signed in (src/app/sign-in.tsx takes
 * the pending action after closing back to this screen).
 */
export function useGate() {
  const { status } = useAuth();
  return useCallback(
    (action: Action, run: () => void) => {
      if (!needsSignIn(action, status)) return run();
      deferUntilSignedIn(action, run);
      router.push('/sign-in');
    },
    [status]
  );
}
