import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/ui';

/** Events list (M21 §4.3): filled in B1 (list, filters, detail, live slots). */
export default function EventsScreen() {
  const { t } = useTranslation();
  return <EmptyState text={t('events.empty')} />;
}
