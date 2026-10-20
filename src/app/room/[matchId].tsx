import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Notice } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { errorText } from '@/lib/errors';
import { named } from '@/lib/esports';
import { ApiError, getRoom } from '@/lib/esports-api';
import { dateTime, type Lang } from '@/lib/format';
import { acceptCredentials, credentialsFor, onCredentialsChange } from '@/lib/room-credentials';
import { keys } from '@/lib/use-realtime';

/**
 * The room (M21-FR-15 to FR-17). Only checked-in players get it, from the reveal time. The ID and
 * password come from the API or the socket and stay in memory (never stored, never logged); the
 * newest version wins, so a rotation replaces them on screen at once. Screenshots are blocked here.
 */
export default function RoomScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  usePreventScreenCapture('room');

  const room = useQuery({
    queryKey: keys.room(matchId),
    queryFn: () => getRoom(matchId),
    gcTime: 0, // credentials are not kept in the query cache after the screen closes
    retry: false,
    // Not revealed yet or not entered yet: ask again every 30 s (the socket usually arrives first).
    refetchInterval: (q) => (q.state.data ? false : 30_000),
  });

  // The in-memory store is the source of truth for what is shown (API reads and socket events both feed it).
  const creds = useSyncExternalStore(
    (cb) => onCredentialsChange(cb),
    () => credentialsFor(matchId),
    () => null
  );
  useEffect(() => {
    if (room.data) acceptCredentials({ matchId, version: room.data.version, roomId: room.data.roomId, password: room.data.password });
  }, [room.data, matchId]);

  // A higher version after the first one means staff rotated the room.
  const firstVersion = useRef<number | null>(null);
  const [rotated, setRotated] = useState(false);
  useEffect(() => {
    if (!creds) return;
    if (firstVersion.current === null) firstVersion.current = creds.version;
    else if (creds.version > firstVersion.current) setRotated(true);
  }, [creds]);

  const err = room.error instanceof ApiError ? room.error : null;
  const waitText =
    err?.code === 'ESPORTS_ROOM_NOT_REVEALED'
      ? t('room.notYet', { at: dateTime(String(err.problem.revealAt ?? new Date().toISOString()), lang) })
      : err?.code === 'ESPORTS_NOT_CHECKED_IN'
        ? t('room.notCheckedIn')
        : err?.code === 'ESPORTS_ROOM_NOT_SET'
          ? t('room.notSet')
          : err?.code === 'RATE_LIMITED'
            ? t('room.tooMany')
            : room.error
              ? errorText(t, room.error)
              : null;

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.page}>
      {rotated ? <Notice text={t('room.rotated')} /> : null}
      {creds ? (
        <>
          <Secret label={t('room.roomId')} value={creds.roomId} />
          <Secret label={t('room.password')} value={creds.password} />
          {room.data?.map ? <ThemedText>{t('room.map', { map: named(room.data.map, lang) })}</ThemedText> : null}
          {room.data?.startsAt ? <ThemedText themeColor="textSecondary">{t('room.startsAt', { at: dateTime(room.data.startsAt, lang) })}</ThemedText> : null}
          <Notice text={t('room.private')} />
        </>
      ) : room.isLoading ? (
        <ActivityIndicator color={theme.brand} />
      ) : (
        <Notice tone={err?.code === 'ESPORTS_NOT_CHECKED_IN' ? 'error' : 'info'} text={waitText ?? t('common.loading')} />
      )}
    </ScrollView>
  );
}

function Secret({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <View style={[styles.secret, { borderColor: theme.brand, backgroundColor: theme.backgroundElement }]}>
      <View style={{ flex: 1 }}>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText style={styles.value} selectable={false}>
          {value}
        </ThemedText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('room.copy')} ${label}`}
        onPress={() => void Clipboard.setStringAsync(value).then(() => setCopied(true))}
        style={[styles.copy, { borderColor: theme.text }]}>
        <ThemedText type="smallBold">{copied ? t('room.copied') : t('room.copy')}</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12 },
  secret: { borderWidth: 2, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  value: { fontSize: 28, lineHeight: 36, fontWeight: '800', fontFamily: 'monospace', letterSpacing: 1 },
  copy: { minHeight: 48, minWidth: 72, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
});
