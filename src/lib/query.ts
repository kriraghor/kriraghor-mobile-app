import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

/**
 * Server state (TanStack Query). Screens read through queries; realtime events (Socket.IO) and
 * push taps invalidate them, so data is re-read from the API rather than trusted from the event.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnReconnect: true },
    mutations: { retry: 0 },
  },
});

// Refetch when the app comes back to the foreground (the web build uses the window focus).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
}
