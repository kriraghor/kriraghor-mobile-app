import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { SectionTitle } from '@/components/esports';
import { Card, ErrorNotice, GymGate } from '@/components/gym';
import { PlanList, TodayCard } from '@/components/gym-today';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { useMyPlans } from '@/lib/use-gym';
import { keys } from '@/lib/use-realtime';

/**
 * Today (Gym tab, M24-FR-65): today's workout and meals across my gyms, each opening its plan to tick,
 * then every plan and diet chart I have. Nothing for today → say so; signed out → sign in.
 */
export default function GymToday() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { status } = useAuth();
  const qc = useQueryClient();
  const plans = useMyPlans();

  if (status !== 'signed_in' || plans.isLoading) return <GymGate loading={plans.isLoading} />;

  const items = plans.data?.items ?? [];
  const today = plans.data?.today ?? null;
  const live = items.some((i) => !i.readOnly && i.todayIndex !== null);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={plans.isRefetching} onRefresh={() => void qc.invalidateQueries({ queryKey: keys.gymPlans })} tintColor={theme.brand} />}>
      <ErrorNotice error={plans.error} onRetry={() => void plans.refetch()} />
      {plans.data ? (
        <>
          <TodayCard items={items} today={today} />
          {!live ? (
            <Card>
              <ThemedText type="smallBold">{t('gymToday.none')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('gymToday.noneBody')}
              </ThemedText>
            </Card>
          ) : null}
          <SectionTitle>{t('gymToday.allPlans')}</SectionTitle>
          {items.length ? (
            <PlanList items={items} />
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              {t('gymToday.noPlans')}
            </ThemedText>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12, paddingBottom: 32 },
});
