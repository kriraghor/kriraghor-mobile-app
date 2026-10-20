import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { config } from '@/lib/config';

/** Home. The open events strip and top players arrive with B1 and B2. */
export default function Home() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { status } = useAuth();
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={[styles.page, { paddingTop: insets.top + 20 }]}>
      <View style={[styles.hero, { backgroundColor: '#0A1A12' }]}>
        <ThemedText style={[styles.title, { color: '#F4F3EF' }]}>{t('home.heroTitle')}</ThemedText>
        <ThemedText style={[styles.title, { color: theme.prize }]}>{t('home.heroPrize')}</ThemedText>
        <ThemedText style={[styles.sub, { color: '#B9C6BE' }]}>{t('home.heroSub')}</ThemedText>
      </View>
      <View style={styles.actions}>
        {status === 'signed_in' ? (
          <Button title={t('home.myAccount')} onPress={() => router.push('/account')} />
        ) : (
          <Button title={t('common.signIn')} onPress={() => router.push('/sign-in')} />
        )}
      </View>
      {config.appEnv !== 'production' ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.env}>
          {config.appEnv} · {config.apiUrl}
        </ThemedText>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, gap: 24 },
  hero: { padding: 24, gap: 8 },
  title: { fontSize: 30, lineHeight: 38, fontWeight: '800' },
  sub: { marginTop: 8, fontSize: 16, lineHeight: 24 },
  actions: { gap: 12 },
  env: { textAlign: 'center' },
});
