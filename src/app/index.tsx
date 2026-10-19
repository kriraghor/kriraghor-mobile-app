import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { config } from '@/lib/config';

/** Home placeholder. Esports and booking screens arrive with M21 (phase 3) and M10 (phase 4). */
export default function Home() {
  const theme = useTheme();
  const { status } = useAuth();
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.page}>
      <View style={[styles.hero, { backgroundColor: '#0A1A12' }]}>
        <ThemedText style={[styles.title, { color: '#F4F3EF' }]}>
          Play PUBG Mobile and Free Fire.
        </ThemedText>
        <ThemedText style={[styles.title, { color: theme.prize }]}>Win real prizes.</ThemedText>
        <ThemedText style={[styles.sub, { color: '#B9C6BE' }]}>
          Events, venues and gear in one account.
        </ThemedText>
      </View>
      <View style={styles.actions}>
        {status === 'signed_in' ? (
          <Button title="My account" onPress={() => router.push('/me')} />
        ) : (
          <Button title="Sign in" onPress={() => router.push('/sign-in')} />
        )}
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.env}>
        {config.appEnv} · {config.apiUrl}
      </ThemedText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, gap: 24 },
  hero: { padding: 24, gap: 8 },
  title: { fontSize: 30, lineHeight: 34, fontWeight: '800' },
  sub: { marginTop: 8, fontSize: 16 },
  actions: { gap: 12 },
  env: { textAlign: 'center' },
});
