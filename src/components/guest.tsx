import { Icon, type IconName } from '@/components/icons/Icon';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Button, Reveal, SkeletonList } from '@/components/ui';
import { Radius } from '@/constants/motion';
import { useTabBarInset } from '@/hooks/use-tab-bar-inset';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';


/**
 * A friendly signed-out state for a screen that shows the person's own things (my matches, my
 * passes, my winnings): what signing in gives, Sign in (the modal closes back here), and a way to
 * keep browsing. Never a dead end.
 */
export function SignInPrompt({ text, icon = 'account', browse }: { text?: string; icon?: IconName; browse?: { title: string; onPress: () => void } }) {
  const theme = useTheme();
  const tabInset = useTabBarInset();
  const { t } = useTranslation();
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={[styles.page, { paddingBottom: 16 + tabInset }]}>
      <Reveal style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.line }]}>
        <View style={[styles.icon, { backgroundColor: theme.accentSoft }]}>
          <Icon name={icon} size={28} color={theme.accentText} active />
        </View>
        <ThemedText type="heading" accessibilityRole="header">
          {t('guest.title')}
        </ThemedText>
        <ThemedText themeColor="textSecondary">{text ?? t('guest.body')}</ThemedText>
        <Button title={t('common.signIn')} icon="sign-in" onPress={() => router.push('/sign-in')} />
        {browse ? <Button title={browse.title} variant="outline" onPress={browse.onPress} /> : null}
      </Reveal>
    </ScrollView>
  );
}

/** A screen of the person's own things: loading → skeletons, signed out → SignInPrompt, else the screen. */
export function SignedInOnly({ children, text, icon, browse }: { children: ReactNode; text?: string; icon?: IconName; browse?: { title: string; onPress: () => void } }) {
  const { t } = useTranslation();
  const { status } = useAuth();
  if (status === 'loading') return <SkeletonList label={t('common.loading')} />;
  if (status !== 'signed_in') return <SignInPrompt text={text} icon={icon} browse={browse} />;
  return <>{children}</>;
}

const styles = StyleSheet.create({
  page: { padding: 16, flexGrow: 1, justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: Radius.card, padding: 24, gap: 16 },
  icon: { width: 64, height: 64, borderRadius: Radius.card, alignItems: 'center', justifyContent: 'center' },
});
