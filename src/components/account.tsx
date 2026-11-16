import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Pill } from '@/components/esports';
import { Card, RowLink } from '@/components/gym';
import { useLeaveToHub } from '@/components/transition';
import { ThemedText } from '@/components/themed-text';
import { Avatar, Button, EmptyState, Notice, Reveal, SectionHeading, Skeleton } from '@/components/ui';
import { displayFace } from '@/constants/fonts';
import { Radius } from '@/constants/motion';
import { initials } from '@/lib/ui-logic';
import { useTabBarInset } from '@/hooks/use-tab-bar-inset';
import { useTheme } from '@/hooks/use-theme';
import { LANGUAGES, setLanguage, type Language } from '@/i18n';
import { api, problemMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { PushRegistration } from '@/lib/notifications';
import { enablePush } from '@/lib/push';
import type { Section } from '@/lib/section';
import { useWaitingInvites } from '@/lib/use-gym';

type Me = { id: string; displayName: string; phone: string | null; email: string | null; roles: { role: string; status: string }[] };
const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', bn: 'বাংলা' };

/**
 * The signed-in account (GET /me), the language and notifications. The Account tab of both sections
 * (Esports and Gym) renders this one screen; inside Gym the Gym row is left out (it is the section).
 *
 * UI v2: who I am on a card (initials, name, phone, email), then my things in two groups, the language,
 * notifications, and Sign out last and quiet, so it is never pressed by mistake.
 */
export function AccountScreen({ section }: { section: Section }) {
  const theme = useTheme();
  const tabInset = useTabBarInset();
  const { t } = useTranslation();
  const { status, signOut } = useAuth();
  const [push, setPush] = useState<PushRegistration | null>(null);
  const waiting = useWaitingInvites();
  const me = useQuery({
    queryKey: ['me'],
    enabled: status === 'signed_in',
    queryFn: async () => {
      const { data, error } = await api.GET('/me');
      if (error) throw error;
      return data as Me;
    },
  });

  // Signing out, or All sections: forget the section and show the hub.
  const toHub = useLeaveToHub();

  if (status === 'signed_out') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <LanguagePicker padded />
        <View style={styles.pad}>
          <RowLink icon="sections" label={t('hub.allSections')} onPress={() => void toHub()} />
        </View>
        <EmptyState icon="account" text={t('account.signedOut')} action={{ title: t('common.signIn'), onPress: () => router.push('/sign-in') }} />
      </View>
    );
  }

  const pushText = !push ? t('account.notificationsHelp') : push.status === 'granted' ? t('account.pushRegistered') : push.reason === 'denied' ? t('account.pushDenied') : t('account.pushUnavailable');

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={[styles.page, { paddingBottom: 24 + tabInset }]} refreshControl={<RefreshControl refreshing={me.isRefetching} onRefresh={() => void me.refetch()} tintColor={theme.brand} />}>
      {me.error ? <Notice tone="error" text={problemMessage(me.error, t('common.somethingWrong'))} /> : null}
      {me.data ? (
        <Reveal>
          <Card>
            <View style={styles.who}>
              <Avatar letters={initials(me.data.displayName)} size={60} />
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.name} numberOfLines={2} accessibilityRole="header">
                  {me.data.displayName}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {me.data.phone ?? me.data.email ?? ''}
                </ThemedText>
              </View>
            </View>
            <View style={[styles.rule, { backgroundColor: theme.line }]} />
            <Row label={t('account.phone')} value={me.data.phone ?? '–'} />
            <Row label={t('account.email')} value={me.data.email ?? '–'} />
            {me.data.roles.length ? (
              <View style={styles.roles} accessibilityLabel={t('account.roles')}>
                {me.data.roles.map((r) => (
                  <Pill key={r.role} text={roleName(r.role)} tone={r.status === 'active' ? 'brand' : 'neutral'} />
                ))}
              </View>
            ) : null}
            <ThemedText type="small" themeColor="textSecondary">
              {t('account.sameSession')}
            </ThemedText>
          </Card>
        </Reveal>
      ) : (
        <Skeleton height={176} radius={Radius.card} />
      )}

      <View style={styles.group}>
        <SectionHeading small title={t('hub.tiles.esports.title')} />
        <RowLink icon="id-card" label={t('gameIds.title')} onPress={() => router.push('/game-ids')} />
        <RowLink icon="people" label={t('squads.title')} onPress={() => router.push('/squads')} />
        <RowLink icon="wallet" label={t('winnings.title')} onPress={() => router.push('/winnings')} />
      </View>

      <View style={styles.group}>
        <SectionHeading small title={t('account.more')} />
        <RowLink icon="bell" label={t('notifications.title')} onPress={() => router.push('/notifications')} />
        {section === 'esports' ? <RowLink icon="gym" label={t('gym.title')} badge={waiting} onPress={() => router.push('/gym')} /> : null}
        <RowLink icon="sections" label={t('hub.allSections')} onPress={() => void toHub()} />
      </View>

      <LanguagePicker />

      <Card>
        <ThemedText type="smallBold">{t('account.notifications')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {pushText}
        </ThemedText>
        {push?.status !== 'granted' ? <Button title={t('account.enableNotifications')} variant="secondary" icon="bell" onPress={() => void enablePush().then(setPush)} /> : null}
      </Card>

      <Button title={t('common.signOut')} variant="outline" onPress={() => void signOut().then(toHub)} />
    </ScrollView>
  );
}

/** English or Bangla; the choice is kept on this phone. */
function LanguagePicker({ padded }: { padded?: boolean }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  return (
    <View style={[styles.language, padded && styles.pad]}>
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
              style={[styles.option, { borderColor: selected ? theme.brand : theme.line, backgroundColor: selected ? theme.brand : theme.backgroundElement }]}>
              <ThemedText type="smallBold" style={{ color: selected ? theme.onBrand : theme.text }}>
                {LANGUAGE_NAMES[lng]}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** "gym_owner" → "Gym owner": a role's key in words, until the roles have names of their own in both languages. */
const roleName = (role: string) => {
  const words = role.replace(/[_-]+/g, ' ').trim();
  return words ? words[0].toUpperCase() + words.slice(1) : role;
};

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
  page: { padding: 16, gap: 20 },
  pad: { paddingHorizontal: 16, paddingTop: 16 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  name: { ...displayFace, fontSize: 24, lineHeight: 30 },
  rule: { height: 1, marginVertical: 4 },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  group: { gap: 10 },
  language: { gap: 8 },
  segment: { flexDirection: 'row', gap: 8 },
  option: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 12 },
  rowLabel: { width: 72 },
  rowValue: { flex: 1 },
});
