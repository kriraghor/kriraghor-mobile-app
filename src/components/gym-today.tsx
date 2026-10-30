import { Icon } from '@/components/icons/Icon';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { Pill } from '@/components/esports';
import { Card } from '@/components/gym';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { dateOnly, groupsOn, latestTicks, progressOn, textOf, todayFirst } from '@/lib/gym';
import type { PlanItem } from '@/lib/gym-api';
import { count, type Lang } from '@/lib/format';

/** Today's plan in the Gym section: the card on My gyms and the Today tab, and the list of all my plans. */

const openPlan = (assignmentId: string) => router.push({ pathname: '/gym/plans/[assignmentId]', params: { assignmentId } });

/** Today's workout and meals in one card (M24-FR-65), each opening its plan; hidden without a live plan for today. */
export function TodayCard({ items, today }: { items: PlanItem[]; today: string | null }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const live = today ? todayFirst(items).filter((i) => !i.readOnly && i.todayIndex !== null) : [];
  if (!today || !live.length) return null;
  return (
    <Card>
      <ThemedText type="smallBold" style={{ fontSize: 16 }}>
        {t('gymPlan.todayTitle')} · {dateOnly(today, lang, { weekday: true, year: false })}
      </ThemedText>
      {live.map((it) => {
        const groups = groupsOn(it, today) ?? [];
        const refs = groups.flatMap((g) => g.refs);
        const p = progressOn(refs, latestTicks(it.ticks), today);
        const name = it.kind === 'workout' ? groups.map((g) => textOf(g.name, lang)).join(', ') || it.title : it.title;
        return (
          <Pressable
            key={it.assignmentId}
            accessibilityRole="button"
            onPress={() => openPlan(it.assignmentId)}
            style={({ pressed }) => [styles.todayRow, { borderTopColor: theme.line }, pressed && { opacity: 0.85 }]}>
            <Icon name={it.kind === 'workout' ? 'gym' : 'food'} size={22} color={theme.brandText} />
            <View style={{ flex: 1 }}>
              <ThemedText type="smallBold" numberOfLines={2}>
                {refs.length || it.kind === 'diet' ? name : t('gymPlan.restDay')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {it.gym?.name ?? ''}
              </ThemedText>
            </View>
            {refs.length ? (
              <ThemedText type="smallBold">{t('gymPlan.progress', { done: count(p.done, lang), total: count(p.total, lang) })}</ThemedText>
            ) : null}
            <Icon name="chevron-right" size={20} color={theme.textSecondary} />
          </Pressable>
        );
      })}
    </Card>
  );
}

/** Every plan and diet chart I have, today's first, ended ones last (read-only, still readable). */
export function PlanList({ items }: { items: PlanItem[] }) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View style={{ gap: 8 }}>
      {todayFirst(items).map((it) => (
        <Pressable
          key={it.assignmentId}
          accessibilityRole="button"
          onPress={() => openPlan(it.assignmentId)}
          style={({ pressed }) => [styles.planRow, { borderColor: theme.line, backgroundColor: theme.backgroundElement }, it.readOnly && { opacity: 0.7 }, pressed && { opacity: 0.85 }]}>
          <Icon name={it.kind === 'workout' ? 'gym' : 'food'} size={22} color={theme.text} />
          <View style={{ flex: 1 }}>
            <ThemedText type="smallBold" numberOfLines={2}>
              {it.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {t(`gymPlan.kind.${it.kind}`)}
              {it.gym?.name ? ` · ${it.gym.name}` : ''}
            </ThemedText>
          </View>
          {it.readOnly ? <Pill text={t('gymToday.ended')} tone="neutral" /> : null}
          <Icon name="chevron-right" size={20} color={theme.textSecondary} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  todayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, borderTopWidth: 1, paddingTop: 8 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderWidth: 1.5, padding: 12 },
});
