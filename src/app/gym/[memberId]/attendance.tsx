import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SectionTitle } from '@/components/esports';
import { Card, ErrorNotice, GymGate } from '@/components/gym';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { dateOnly, dhakaToday, monthGrid, monthOf, monthTitle, shiftMonth, timeOnly, weekHeads } from '@/lib/gym';
import { myAttendance } from '@/lib/gym-api';
import { count, type Lang } from '@/lib/format';
import { keys } from '@/lib/use-realtime';

/**
 * My check-in calendar at one gym (M24 §4.5 gym/[memberId]/attendance), month by month, Saturday
 * first like the Bangladesh week. Days I came are filled; today has a frame; no month after this one.
 */
export default function GymAttendance() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const { status } = useAuth();
  const today = dhakaToday();
  const [month, setMonth] = useState(monthOf(today));
  const cal = useQuery({ queryKey: keys.gymAttendance(memberId, month), queryFn: () => myAttendance(memberId, month), enabled: status === 'signed_in' && !!memberId });

  if (status !== 'signed_in') return <GymGate loading={false} />;
  const weeks = monthGrid(month, cal.data?.days.map((d) => d.date) ?? [], lang);
  const atLatest = month >= monthOf(today);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={cal.isRefetching} onRefresh={() => void cal.refetch()} tintColor={theme.brand} />}>
      <View style={styles.monthBar}>
        <MonthButton icon="chevron-left" label={t('gymAttendance.prev')} onPress={() => setMonth(shiftMonth(month, -1))} />
        <ThemedText type="smallBold" style={styles.month}>
          {monthTitle(month, lang)}
        </ThemedText>
        <MonthButton icon="chevron-right" label={t('gymAttendance.next')} disabled={atLatest} onPress={() => setMonth(shiftMonth(month, 1))} />
      </View>

      <ErrorNotice error={cal.error} onRetry={() => void cal.refetch()} />
      <Card>
        <View style={styles.week}>
          {weekHeads(lang).map((h) => (
            <ThemedText key={h} type="small" themeColor="textSecondary" style={styles.head} numberOfLines={1}>
              {h}
            </ThemedText>
          ))}
        </View>
        {weeks.map((w, i) => (
          <View key={i} style={styles.week}>
            {w.map((c, j) => (
              <View
                key={c?.date ?? `x${i}-${j}`}
                accessibilityLabel={c ? `${dateOnly(c.date, lang)}${c.came ? `, ${t('gymAttendance.came')}` : ''}` : undefined}
                style={[styles.cell, c?.came && { backgroundColor: theme.brand }, c?.date === today && { borderColor: theme.text, borderWidth: 2 }]}>
                {c ? (
                  <ThemedText type="small" style={{ color: c.came ? theme.onBrand : c.date > today ? theme.textSecondary : theme.text, fontWeight: c.came ? '700' : '500' }}>
                    {c.label}
                  </ThemedText>
                ) : null}
              </View>
            ))}
          </View>
        ))}
        <ThemedText type="smallBold">{cal.isLoading ? t('common.loading') : t('gymAttendance.count', { n: count(cal.data?.count ?? 0, lang) })}</ThemedText>
      </Card>

      {cal.data?.days.length ? (
        <>
          <SectionTitle>{t('gymAttendance.visits')}</SectionTitle>
          {cal.data.days.map((d) => (
            <View key={d.date} style={[styles.line, { borderBottomColor: theme.line }]}>
              <ThemedText type="small" style={{ flex: 1 }}>
                {dateOnly(d.date, lang, { weekday: true, year: false })}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {timeOnly(d.at, lang)} · {t(`gymAttendance.method.${d.method === 'entrance_qr' || d.method === 'member_qr' || d.method === 'pass' ? d.method : 'desk'}`)}
              </ThemedText>
            </View>
          ))}
        </>
      ) : !cal.isLoading && !cal.error ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('gymAttendance.none')}
        </ThemedText>
      ) : null}
    </ScrollView>
  );
}

function MonthButton({ icon, label, onPress, disabled }: { icon: 'chevron-left' | 'chevron-right'; label: string; onPress: () => void; disabled?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={[styles.monthButton, { borderColor: theme.line, opacity: disabled ? 0.4 : 1 }]}>
      <MaterialCommunityIcons name={icon} size={24} color={theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12, paddingBottom: 32 },
  monthBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  month: { flex: 1, textAlign: 'center', fontSize: 16 },
  monthButton: { width: 48, height: 48, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row', gap: 4 },
  head: { flex: 1, textAlign: 'center', fontSize: 12 },
  cell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 0, borderColor: 'transparent' },
  line: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
});
