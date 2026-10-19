import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Button, Notice } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { api, problemMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { registerForPush, type PushRegistration } from '@/lib/notifications';

type Me = { id: string; displayName: string; phone: string | null; email: string | null; roles: { role: string; status: string }[] };

/** The signed-in account (GET /me) and the push registration status (sending starts with M08). */
export default function MeScreen() {
  const theme = useTheme();
  const { status, signOut } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [push, setPush] = useState<PushRegistration | null>(null);

  useEffect(() => {
    if (status !== 'signed_in') return;
    api.GET('/me').then(({ data, error: err }) => (err ? setError(problemMessage(err)) : setMe(data as Me)));
  }, [status]);

  if (status === 'signed_out') {
    return (
      <View style={[styles.page, { backgroundColor: theme.background, flex: 1 }]}>
        <ThemedText>You are not signed in.</ThemedText>
        <Button title="Sign in" onPress={() => router.push('/sign-in')} />
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.page}>
      {error ? <Notice tone="error" text={error} /> : null}
      {me ? (
        <>
          <ThemedText style={styles.title}>{me.displayName}</ThemedText>
          <ThemedText themeColor="textSecondary">This session also works on kriraghor.com and esports.</ThemedText>
          <View style={[styles.card, { borderTopColor: theme.text }]}>
            <Row label="Phone" value={me.phone ?? '–'} />
            <Row label="Email" value={me.email ?? '–'} />
            <Row label="Roles" value={me.roles.map((r) => `${r.role} (${r.status})`).join(', ')} />
          </View>
        </>
      ) : (
        <ThemedText themeColor="textSecondary">Loading your account</ThemedText>
      )}

      <View style={styles.card}>
        <ThemedText type="smallBold">Notifications</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {push ? (push.status === 'granted' ? `Registered: ${push.token}` : push.reason) : 'Event alerts (room IDs, results) arrive with M08.'}
        </ThemedText>
        <Button title="Enable notifications" variant="outline" onPress={() => void registerForPush().then(setPush)} />
      </View>

      <Button
        title="Sign out"
        onPress={() =>
          void signOut().then(() => {
            router.replace('/');
          })
        }
      />
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.rowLabel}>
        {label}
      </ThemedText>
      <ThemedText type="small" style={styles.rowValue}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, gap: 16 },
  title: { fontSize: 28, lineHeight: 32, fontWeight: '800' },
  card: { gap: 8, borderTopWidth: 2, borderTopColor: 'transparent', paddingTop: 12 },
  row: { flexDirection: 'row', gap: 12 },
  rowLabel: { width: 72 },
  rowValue: { flex: 1 },
});
