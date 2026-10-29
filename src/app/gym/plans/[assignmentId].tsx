import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Pill, SectionTitle, Segments } from '@/components/esports';
import { Card, ErrorNotice, GymGate, ItemFacts, Safety } from '@/components/gym';
import { ThemedText } from '@/components/themed-text';
import { Button, Notice } from '@/components/ui';
import { withTypeface } from '@/constants/fonts';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { canLog, dateOnly, dhakaToday, groupsOn, latestTicks, logDays, progressOn, textOf, tickKey, weekdayOf, type Tick } from '@/lib/gym';
import { logPlan, myPlan, type MyPlan } from '@/lib/gym-api';
import { count, type Lang } from '@/lib/format';
import { useMyPlans } from '@/lib/use-gym';
import { keys } from '@/lib/use-realtime';

type TickInput = { localDate: string; itemRef: string; done: boolean; note: string | null };

/**
 * One plan or diet chart (M24 §4.5 gym/plans/[assignmentId], M24-FR-64 to FR-69): today first with a
 * Done tick and a note per item, for today and the days the API still allows (gym_manage.plan_log_back_days);
 * then the week and the whole plan. A video link opens in the browser. "Given by {gym}, not medical
 * advice" on top. Ended, replaced or left plans are read-only (FR-67).
 */
export default function GymPlanScreen() {
  const { assignmentId } = useLocalSearchParams<{ assignmentId: string }>();
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const { status } = useAuth();
  const qc = useQueryClient();
  const plan = useQuery({ queryKey: keys.gymPlan(assignmentId), queryFn: () => myPlan(assignmentId), enabled: status === 'signed_in' && !!assignmentId });
  const list = useMyPlans(); // today and the tick window come with the list
  const today = list.data?.today ?? dhakaToday();
  const back = list.data?.logBackDays ?? 0;
  const [day, setDay] = useState(today);
  const [tickError, setTickError] = useState<unknown>(null);

  const tick = useMutation({
    mutationFn: (v: TickInput) => logPlan(assignmentId, v),
    onMutate: async (v) => {
      setTickError(null);
      await qc.cancelQueries({ queryKey: keys.gymPlan(assignmentId) });
      const before = qc.getQueryData<MyPlan>(keys.gymPlan(assignmentId));
      if (before) {
        const row = { id: `pending-${Date.now()}`, assignmentId, ...v, createdAt: new Date().toISOString() };
        qc.setQueryData<MyPlan>(keys.gymPlan(assignmentId), { ...before, logs: [row, ...before.logs], ticks: [row, ...before.ticks] });
      }
      return { before };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.before) qc.setQueryData(keys.gymPlan(assignmentId), ctx.before);
      setTickError(err);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.gymPlan(assignmentId) });
      void qc.invalidateQueries({ queryKey: keys.gymPlans });
    },
  });

  if (status !== 'signed_in' || plan.isLoading) return <GymGate loading={plan.isLoading} />;
  const p = plan.data;
  if (!p) {
    return (
      <View style={[styles.page, { flex: 1, backgroundColor: theme.background }]}>
        <ErrorNotice error={plan.error} onRetry={() => void plan.refetch()} />
      </View>
    );
  }

  const ticks = latestTicks(p.logs.length ? p.logs : p.ticks);
  const days = p.readOnly ? [] : logDays(today, back);
  const date = days.includes(day) ? day : today;
  const loggable = canLog(date, today, back, p.readOnly);
  const groups = groupsOn(p, date);
  const refs = groups?.flatMap((g) => g.refs) ?? [];
  const progress = progressOn(refs, ticks, date);
  const content = p.content;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={plan.isRefetching} onRefresh={() => void plan.refetch()} tintColor={theme.brand} />}>
      <View style={{ gap: 4 }}>
        <ThemedText style={styles.title}>{p.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {[p.gym?.name, t(`gymPlan.kind.${p.kind}`), t('gymPlan.version', { n: count(p.version, lang) })].filter(Boolean).join(' · ')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('gymPlan.from', { date: dateOnly(p.startsOn, lang) })}
          {p.endsOn ? ` · ${t('gymPlan.until', { date: dateOnly(p.endsOn, lang) })}` : ''}
        </ThemedText>
      </View>
      <Safety text={p.safety} />
      {p.readOnly ? <Notice text={t('gymPlan.readOnly')} /> : null}

      {!p.readOnly ? (
        <>
          {days.length > 1 ? (
            <View style={{ marginHorizontal: -16 }}>
              <Segments
                items={days.map((d, i) => ({ key: d, label: i === 0 ? t('gymPlan.today') : i === 1 ? t('gymPlan.yesterday') : dateOnly(d, lang, { weekday: true, year: false }) }))}
                value={date}
                onChange={setDay}
              />
            </View>
          ) : null}
          <SectionTitle>{date === today ? t('gymPlan.todayTitle') : dateOnly(date, lang, { weekday: true, year: false })}</SectionTitle>
          <ErrorNotice error={tickError} />
          {!groups ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('gymPlan.notToday')}
            </ThemedText>
          ) : (
            <>
              {refs.length ? (
                <View style={{ gap: 4 }}>
                  <ThemedText type="smallBold">{t('gymPlan.progress', { done: count(progress.done, lang), total: count(progress.total, lang) })}</ThemedText>
                  <View style={[styles.bar, { backgroundColor: theme.backgroundSelected }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: progress.total, now: progress.done }}>
                    <View style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`, height: '100%', backgroundColor: theme.brand }} />
                  </View>
                </View>
              ) : null}
              {groups.map((g) => (
                <Card key={g.key}>
                  <ThemedText type="smallBold" style={{ fontSize: 16 }}>
                    {textOf(g.name, lang)}
                    {g.time ? `  ${g.time}` : ''}
                  </ThemedText>
                  {!g.refs.length ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {p.kind === 'workout' ? t('gymPlan.restDay') : t('gymPlan.noItems')}
                    </ThemedText>
                  ) : null}
                  {g.refs.map((ref) => (
                    <TickRow key={ref} itemRef={ref} content={content} tick={ticks.get(tickKey(date, ref))} canTick={loggable} busy={tick.isPending && tick.variables?.itemRef === ref} onTick={(done, note) => tick.mutate({ localDate: date, itemRef: ref, done, note })} />
                  ))}
                </Card>
              ))}
            </>
          )}
        </>
      ) : null}

      {p.kind === 'workout' && p.week.length ? (
        <>
          <SectionTitle>{t('gymPlan.week')}</SectionTitle>
          <View style={styles.weekGrid}>
            {p.week.map((w) => {
              const d = w.index !== null && content.kind === 'workout' ? content.days[w.index] : null;
              return (
                <View key={w.date} style={[styles.weekDay, { borderColor: w.date === today ? theme.brand : theme.line, backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="smallBold" style={{ fontSize: 12 }}>
                    {weekdayOf(w.date, lang)}
                  </ThemedText>
                  <ThemedText type="small" themeColor={d ? 'text' : 'textSecondary'} style={{ fontSize: 12, lineHeight: 16, textAlign: 'center' }} numberOfLines={2}>
                    {d ? textOf(d.name, lang) : '–'}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        </>
      ) : null}

      <SectionTitle>{t('gymPlan.whole')}</SectionTitle>
      {content.kind === 'workout'
        ? content.days.map((d, i) => (
            <Card key={d.key}>
              <View style={styles.dayHead}>
                <ThemedText type="smallBold" style={{ flex: 1, fontSize: 16 }}>
                  {t('gymPlan.dayN', { n: count(i + 1, lang) })} · {textOf(d.name, lang)}
                </ThemedText>
                {!p.readOnly && p.todayIndex === i ? <Pill text={t('gymPlan.today')} tone="brand" /> : null}
              </View>
              {d.items.length ? (
                d.items.map((x) => <ItemFacts key={x.ref} content={content} itemRef={x.ref} />)
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('gymPlan.restDay')}
                </ThemedText>
              )}
            </Card>
          ))
        : content.meals.map((m) => (
            <Card key={m.ref}>
              <ThemedText type="smallBold" style={{ fontSize: 16 }}>
                {textOf(m.name, lang)}
                {m.time ? `  ${m.time}` : ''}
              </ThemedText>
              {m.items.map((x) => (
                <ItemFacts key={x.ref} content={content} itemRef={x.ref} />
              ))}
            </Card>
          ))}
      {content.kind === 'diet' && content.notes && textOf(content.notes, lang) ? <Notice text={textOf(content.notes, lang)} /> : null}
    </ScrollView>
  );
}

/** One item with its Done tick and my note (saved one by one; the latest tick per item and date wins). */
function TickRow({ itemRef, content, tick, canTick, busy, onTick }: { itemRef: string; content: MyPlan['content']; tick?: Tick; canTick: boolean; busy: boolean; onTick: (done: boolean, note: string | null) => void }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const done = Boolean(tick?.done);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  return (
    <View style={[styles.item, { borderTopColor: theme.line }]}>
      <View style={styles.itemTop}>
        <ItemFacts content={content} itemRef={itemRef} />
        {canTick ? (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: done, busy }}
            disabled={busy}
            onPress={() => onTick(!done, tick?.note ?? null)}
            style={[styles.done, { borderColor: done ? theme.brand : theme.line, backgroundColor: done ? theme.brand : theme.backgroundElement }]}>
            <MaterialCommunityIcons name={done ? 'check-bold' : 'check'} size={18} color={done ? theme.onBrand : theme.text} />
            <ThemedText type="smallBold" style={{ color: done ? theme.onBrand : theme.text }}>
              {done ? t('gymPlan.done') : t('gymPlan.markDone')}
            </ThemedText>
          </Pressable>
        ) : done ? (
          <Pill text={t('gymPlan.done')} tone="brand" />
        ) : null}
      </View>
      {tick?.note && !editing ? (
        <ThemedText type="small" style={[styles.note, { backgroundColor: theme.backgroundSelected }]}>
          {tick.note}
        </ThemedText>
      ) : null}
      {canTick && editing ? (
        <View style={{ gap: 8 }}>
          <TextInput
            accessibilityLabel={t('gymPlan.myNote')}
            value={draft}
            onChangeText={(v) => setDraft(v.slice(0, 300))}
            placeholder={t('gymPlan.notePlaceholder')}
            placeholderTextColor={theme.textSecondary}
            multiline
            maxLength={300}
            style={withTypeface(StyleSheet.flatten([styles.input, { color: theme.text, borderColor: theme.line, backgroundColor: theme.backgroundElement }]), i18n.language)}
          />
          <View style={styles.noteActions}>
            <View style={{ flex: 1 }}>
              <Button
                title={t('gymPlan.saveNote')}
                busy={busy}
                onPress={() => {
                  onTick(done, draft.trim() || null);
                  setEditing(false);
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button title={t('common.cancel')} variant="outline" onPress={() => setEditing(false)} />
            </View>
          </View>
        </View>
      ) : canTick ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setDraft(tick?.note ?? '');
            setEditing(true);
          }}
          style={styles.noteLink}>
          <MaterialCommunityIcons name="note-edit-outline" size={18} color={theme.brandText} />
          <ThemedText type="smallBold" style={{ color: theme.brandText }}>
            {tick?.note ? t('gymPlan.editNote') : t('gymPlan.addNote')}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12, paddingBottom: 40 },
  title: { fontSize: 22, lineHeight: 30, fontWeight: '800' },
  bar: { height: 8, width: '100%', overflow: 'hidden' },
  item: { gap: 6, borderTopWidth: 1, paddingTop: 10 },
  itemTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  done: { minHeight: 48, minWidth: 96, paddingHorizontal: 10, borderWidth: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  note: { padding: 10 },
  noteLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  noteActions: { flexDirection: 'row', gap: 8 },
  input: { minHeight: 72, borderWidth: 2, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, textAlignVertical: 'top' },
  weekGrid: { flexDirection: 'row', gap: 4 },
  weekDay: { flex: 1, minHeight: 64, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, paddingVertical: 6, gap: 2 },
  dayHead: { flexDirection: 'row', gap: 8, alignItems: 'center' },
});
