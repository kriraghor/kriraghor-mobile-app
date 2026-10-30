import { Icon, type IconName } from '@/components/icons/Icon';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Button, Reveal, SkeletonList } from '@/components/ui';
import { Radius } from '@/constants/motion';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';


/**
 * A friendly signed-out state for a screen that shows the person's own things (my matches, my
 * passes, my winnings): what signing in gives, Sign in (the modal closes back here), and a way to
 * keep browsing. Never a dead end.
 */
export function SignInPrompt({ text, icon = 'account', browse }: { text?: string; icon?: IconName; browse?: { title: string; onPress: () => void } }) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.page}>
      <Reveal style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.line }]}>
        <View style={[styles.icon, { backgroundColor: theme.backgroundSelected }]}>
          <Icon name={icon} size={28} color={theme.brandText} />
        </View>
        <ThemedText style={styles.title} accessibilityRole="header">
          {t('guest.title')}
        </ThemedText>
        <ThemedText themeColor="textSecondary">{text ?? t('guest.body')}</ThemedText>
        <Button title={t('common.signIn')} onPress={() => router.push('/sign-in')} />
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
  icon: { width: 56, height: 56, borderRadius: Radius.control, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, lineHeight: 30, fontWeight: '800' },
});
