import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/ui';

/** Leaderboards and top players (M21-FR-27, FR-28): filled in B2. */
export default function RanksScreen() {
  const { t } = useTranslation();
  return <EmptyState text={t('ranks.empty')} />;
}
