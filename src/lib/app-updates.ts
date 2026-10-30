import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AppState } from 'react-native';

/** At most one update check per this gap, however often the app comes back to the front. */
export const UPDATE_CHECK_GAP_MS = 15 * 60 * 1000;

/** Whether to ask the update server again (never checked, or the gap has passed). */
export function shouldCheck(lastCheckedAt: number, now: number, gapMs = UPDATE_CHECK_GAP_MS): boolean {
  return lastCheckedAt === 0 || now - lastCheckedAt >= gapMs;
}

/** Whether to show the restart prompt: only for an update that is new and not offered already. */
export function shouldPrompt(isNew: boolean, updateId: string | undefined, promptedId: string | null): boolean {
  return isNew && Boolean(updateId) && updateId !== promptedId;
}

/**
 * Over-the-air updates (EAS Update, the "preview" channel in CI). The app checks when it opens and
 * whenever it comes back to the front (at most every 15 minutes), downloads in the background and
 * offers a restart once per update. "Later" is fine: expo-updates starts the downloaded update on
 * the next launch by itself. Offline or a server error just waits for the next check. Off in
 * development builds and where updates are disabled.
 */
export function useAutoUpdates() {
  const { t } = useTranslation();
  const lastCheckedAt = useRef(0);
  const promptedId = useRef<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    const run = async () => {
      const now = Date.now();
      if (busy.current || !shouldCheck(lastCheckedAt.current, now)) return;
      busy.current = true;
      lastCheckedAt.current = now;
      try {
        const check = await Updates.checkForUpdateAsync();
        if (!check.isAvailable) return;
        const fetched = await Updates.fetchUpdateAsync();
        const id = (fetched.manifest as { id?: string } | undefined)?.id;
        if (!shouldPrompt(fetched.isNew, id, promptedId.current)) return;
        promptedId.current = id ?? null;
        Alert.alert(t('updates.title'), t('updates.body'), [
          { text: t('updates.later'), style: 'cancel' },
          { text: t('updates.restart'), onPress: () => void Updates.reloadAsync() },
        ]);
      } catch {
        // Offline or the update server failed: try again at the next check.
      } finally {
        busy.current = false;
      }
    };
    void run();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void run();
    });
    return () => sub.remove();
  }, [t]);
}
