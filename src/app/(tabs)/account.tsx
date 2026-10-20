import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Button, EmptyState, Notice } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { LANGUAGES, setLanguage, type Language } from '@/i18n';
import { api, problemMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { registerForPush, type PushRegistration } from '@/lib/notifications';

type Me = { id: string; displayName: string; phone: string | null; email: string | null; roles: { role: string; status: string }[] };
const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', bn: 'বাংলা' };

/** The signed-in account (GET /me), the language and notifications. */
export default function AccountScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { status, signOut } = useAuth();
  const [push, setPush] = useState<PushRegistration | null>(null);
  const me = useQuery({
    queryKey: ['me'],
    enabled: status === 'signed_in',
    queryFn: async () => {
      const { data, error } = await api.GET('/me');
      if (error) throw error;
      return data as Me;
    },
  });

  if (status === 'signed_out') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <LanguagePicker />
        <EmptyState text={t('account.signedOut')} action={{ title: t('common.signIn'), onPress: () => router.push('/sign-in') }} />
      </View>
    );
  }

  const pushText = !push ? t('account.notificationsHelp') : push.status === 'granted' ? t('account.pushRegistered') : push.reason === 'denied' ? t('account.pushDenied') : t('account.pushUnavailable');

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.page}>
      {me.error ? <Notice tone="error" text={problemMessage(me.error, t('common.somethingWrong'))} /> : null}
      {me.data ? (
        <>
          <ThemedText style={styles.title}>{me.data.displayName}</ThemedText>
          <ThemedText themeColor="textSecondary">{t('account.sameSession')}</ThemedText>
          <View style={[styles.card, { borderTopColor: theme.text }]}>
            <Row label={t('account.phone')} value={me.data.phone ?? '–'} />
            <Row label={t('account.email')} value={me.data.email ?? '–'} />
            <Row label={t('account.roles')} value={me.data.roles.map((r) => `${r.role} (${r.status})`).join(', ')} />
          </View>
        </>
      ) : (
        <ThemedText themeColor="textSecondary">{t('common.loading')}</ThemedText>
      )}

      <LanguagePicker />

      <View style={styles.card}>
        <ThemedText type="smallBold">{t('account.notifications')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {pushText}
        </ThemedText>
        {push?.status !== 'granted' ? <Button title={t('account.enableNotifications')} variant="outline" onPress={() => void registerForPush().then(setPush)} /> : null}
      </View>

      <Button title={t('common.signOut')} onPress={() => void signOut().then(() => router.replace('/'))} />
    </ScrollView>
  );
}

/** English or Bangla; the choice is kept on this phone. */
function LanguagePicker() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  return (
    <View style={[styles.card, styles.pad]}>
      <ThemedText type="smallBold">{t('account.language')}</ThemedText>
      <View style={styles.segment} accessibilityRole="radiogroup">
        {LANGUAGES.map((lng) => {
          const selected = i18n.language === lng;
          return (
            <Pressable
              key={lng}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => void setLanguage(lng)}
              style={[styles.option, { borderColor: selected ? theme.brand : theme.line, backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement }]}>
              <ThemedText type="smallBold" style={{ color: selected ? theme.brandText : theme.text }}>
                {LANGUAGE_NAMES[lng]}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
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
  page: { padding: 20, gap: 20 },
  pad: { paddingHorizontal: 20, paddingTop: 20 },
  title: { fontSize: 28, lineHeight: 36, fontWeight: '800' },
  card: { gap: 8, borderTopWidth: 2, borderTopColor: 'transparent', paddingTop: 12 },
  segment: { flexDirection: 'row', gap: 8 },
  option: { flex: 1, minHeight: 48, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 12 },
  rowLabel: { width: 72 },
  rowValue: { flex: 1 },
});
