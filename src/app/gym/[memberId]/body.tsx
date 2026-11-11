import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SectionTitle } from '@/components/esports';
import { BodyChart, bodyKey, decimal } from '@/components/gym-progress';
import { Card, confirmAction, ErrorNotice, GymGate } from '@/components/gym';
import { ThemedText } from '@/components/themed-text';
import { Button, EmptyState, Field, Notice } from '@/components/ui';
import { Radius } from '@/constants/motion';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { ApiError, idempotencyKey } from '@/lib/esports-api';
import { type Lang } from '@/lib/format';
import { addDays, dateOnly, dhakaToday } from '@/lib/gym';
import { addBody, myBody, voidBody, type BodyEntry } from '@/lib/gym-api';
import { BODY_FIELDS, BODY_UNIT, bodyValues, emptyDraft, fieldsWithData, seriesOf, type BodyDraft, type BodyField } from '@/lib/gym-progress';
import { keys } from '@/lib/use-realtime';

/**
 * My body progress at a gym (M24 §20, FR-128 to FR-130; mirrors the card on gym.kriraghor.com): the
 * change since my first entry, one measurement over time as a line, my entries, and a form to add one
 * (today or an earlier day; a second entry for a day replaces the first). Only I, the gym's owner and my
 * trainers see it. I can remove what I recorded; what the gym recorded stays.
 */
export default function GymBodyScreen() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const { status } = useAuth();
  const { width } = useWindowDimensions();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: bodyKey(memberId), queryFn: () => myBody(memberId), enabled: status === 'signed_in' && !!memberId, retry: false });
  const [picked, setPicked] = useState<BodyField>('weightKg');
  const [back, setBack] = useState(0);
  const [draft, setDraft] = useState<BodyDraft>(emptyDraft);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const key = useRef<string | null>(null);

  if (status !== 'signed_in' || q.isLoading) return <GymGate loading={q.isLoading} />;
  if (!q.data) {
    return (
      <View style={[styles.page, { flex: 1, backgroundColor: theme.background }]}>
        <ErrorNotice error={q.error} onRetry={() => void q.refetch()} />
      </View>
    );
  }
  const data = q.data;
  if (!data.on) return <EmptyState icon="gym" text={t('gymProgress.off')} />;

  const today = dhakaToday();
  const date = addDays(today, -back);
  const limits = data.limits.fields;
  const checked = bodyValues(draft, limits);
  const have = fieldsWithData(data.entries);
  const field = have.includes(picked) ? picked : (have[0] ?? 'weightKg');
  const change = data.change[field];
  const unit = (k: BodyField, n: number) => t(`gymProgress.unit.${BODY_UNIT[k]}`, { n: decimal(n, lang) });
  const store = (fresh: typeof data) => {
    qc.setQueryData(bodyKey(memberId), fresh);
    void qc.invalidateQueries({ queryKey: keys.gymMembership(memberId), exact: true });
  };

  // A retry after a network failure reuses the key; an answer from the API (or success) starts a new one.
  const save = async () => {
    setTried(true);
    setSaved(false);
    if (busy || checked.empty || checked.bad.length) return;
    setBusy(true);
    setError(null);
    key.current ??= idempotencyKey('gymbody');
    try {
      store(await addBody(memberId, { measuredOn: date, ...checked.values }, key.current));
      key.current = null;
      setDraft(emptyDraft());
      setTried(false);
      setBack(0);
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError) key.current = null;
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  const remove = (e: BodyEntry) =>
    confirmAction(t('gymProgress.removeTitle'), t('gymProgress.removeBody', { date: dateOnly(e.measuredOn, lang) }), t('gymProgress.remove'), t('gymProgress.keep'), async () => {
      setError(null);
      try {
        store(await voidBody(memberId, e.id));
      } catch (err) {
        setError(err);
      }
    });

  const chip = (on: boolean) => [styles.chip, { borderColor: on ? theme.brand : theme.line, backgroundColor: on ? theme.brand : theme.backgroundElement }];
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={theme.brand} />}>
      <ThemedText type="small" themeColor="textSecondary">
        {t('gymProgress.lead')}
      </ThemedText>

      {data.entries.length ? (
        <Card>
          {have.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t('gymProgress.show')}>
              {have.map((k) => {
                const on = k === field;
                return (
                  <Pressable key={k} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setPicked(k)} style={chip(on)}>
                    <ThemedText type="smallBold" style={{ color: on ? theme.onBrand : theme.text }}>
                      {t(`gymProgress.field.${k}`)}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
          {change ? (
            <ThemedText type="small">
              <ThemedText type="smallBold">{t(change.delta > 0 ? 'gymProgress.up' : change.delta < 0 ? 'gymProgress.down' : 'gymProgress.same', { amount: unit(field, Math.abs(change.delta)) })}</ThemedText>{' '}
              {t('gymProgress.since', { date: dateOnly(change.fromOn, lang), from: unit(field, change.from), to: unit(field, change.to) })}
            </ThemedText>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              {t('gymProgress.oneEntry')}
            </ThemedText>
          )}
          <BodyChart field={field} series={seriesOf(data.entries, field)} width={Math.min(width, 640) - 64} />
        </Card>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {t('gymProgress.empty')}
        </ThemedText>
      )}

      <SectionTitle>{t('gymProgress.add')}</SectionTitle>
      <Card>
        <ThemedText type="smallBold">{t('gymProgress.date')}</ThemedText>
        <View style={styles.stepper}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('gymProgress.dayBefore')} disabled={back >= data.limits.backdateDays} onPress={() => setBack(back + 1)} style={[styles.step, { borderColor: theme.line, opacity: back >= data.limits.backdateDays ? 0.4 : 1 }]}>
            <ThemedText type="smallBold">‹</ThemedText>
          </Pressable>
          <ThemedText type="smallBold" style={{ flex: 1, textAlign: 'center' }}>
            {back === 0 ? t('gymProgress.today') : dateOnly(date, lang, { weekday: true })}
          </ThemedText>
          <Pressable accessibilityRole="button" accessibilityLabel={t('gymProgress.dayAfter')} disabled={back === 0} onPress={() => setBack(back - 1)} style={[styles.step, { borderColor: theme.line, opacity: back === 0 ? 0.4 : 1 }]}>
            <ThemedText type="smallBold">›</ThemedText>
          </Pressable>
        </View>
        {data.entries.some((e) => e.measuredOn === date) ? <Notice text={t('gymProgress.replaces')} /> : null}
        <View style={styles.grid}>
          {BODY_FIELDS.map((k) => (
            <View key={k} style={styles.cell}>
              <Field
                label={t(`gymProgress.label.${k}`)}
                value={draft[k]}
                onChangeText={(v) => (setSaved(false), setDraft({ ...draft, [k]: v.replace(/[^0-9০-৯.,]/g, '').slice(0, 5) }))}
                keyboardType="decimal-pad"
                errorText={tried && checked.bad.includes(k) ? t('gymProgress.range', { min: decimal(limits[k].min, lang), max: decimal(limits[k].max, lang) }) : undefined}
              />
            </View>
          ))}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {t('gymProgress.hint')}
        </ThemedText>
        {tried && checked.empty ? <Notice tone="error" text={t('gymProgress.needOne')} /> : null}
        {saved ? <Notice text={t('gymProgress.saved')} /> : null}
        <ErrorNotice error={error} />
        <Button title={t('gymProgress.save')} busy={busy} onPress={() => void save()} />
      </Card>

      {data.entries.length ? (
        <>
          <SectionTitle>{t('gymProgress.entries')}</SectionTitle>
          {[...data.entries].reverse().map((e) => (
            <Card key={e.id}>
              <ThemedText type="smallBold">{dateOnly(e.measuredOn, lang)}</ThemedText>
              <ThemedText type="small">
                {BODY_FIELDS.filter((k) => e[k] != null)
                  .map((k) => `${t(`gymProgress.short.${k}`)} ${unit(k, e[k] as number)}`)
                  .join(' · ')}
                {e.bmi != null ? ` · ${t('gymProgress.bmi', { n: decimal(e.bmi, lang) })}` : ''}
              </ThemedText>
              {e.byRole === 'staff' ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('gymProgress.byGym')}
                </ThemedText>
              ) : (
                <Button title={t('gymProgress.remove')} variant="outline" onPress={() => remove(e)} />
              )}
            </Card>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12, paddingBottom: 40 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: Radius.control, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  step: { width: 44, height: 44, borderRadius: Radius.control, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { flexGrow: 1, flexBasis: '45%' },
});
