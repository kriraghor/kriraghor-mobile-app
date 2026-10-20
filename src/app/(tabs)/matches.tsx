import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/ui';
import { useAuth } from '@/lib/auth';

/** My matches (M21 §4.3): registrations, check-in, the room reveal. Filled in B1. */
export default function MatchesScreen() {
  const { t } = useTranslation();
  const { status } = useAuth();
  if (status !== 'signed_in') return <EmptyState text={t('matches.signedOut')} action={{ title: t('common.signIn'), onPress: () => router.push('/sign-in') }} />;
  return <EmptyState text={t('common.comingSoon')} />;
}
