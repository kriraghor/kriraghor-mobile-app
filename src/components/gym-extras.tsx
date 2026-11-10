import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { InfoRow, SectionTitle } from '@/components/esports';
import { Card, ErrorNotice } from '@/components/gym';
import { ThemedText } from '@/components/themed-text';
import { Button, Field, Notice } from '@/components/ui';
import { Radius } from '@/constants/motion';
import { useTheme } from '@/hooks/use-theme';
import { count, type Lang } from '@/lib/format';
import { byDay, dateOnly, timeOnly } from '@/lib/gym';
import { gymTimetable, myPoints, saveHealth, visitSlots, type BloodGroup, type Health } from '@/lib/gym-api';
import { keys } from '@/lib/use-realtime';

/**
 * The newer parts of the gym screens (M27 rounds 1 and 2, M24 §17): my points and the gym's rewards,
 * my body (height, weight, BMI, blood group), and on a gym's page the class timetable and the
 * free-visit card. Each reads its own data and hides when the gym's
 * plan does not have the feature.
 */

/** My points at one gym (M27-FR-61): the balance, how to earn, and the rewards. Redeeming is at the front desk. */
export function PointsCard({ memberId }: { memberId: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const q = useQuery({ queryKey: keys.gymPoints(memberId), queryFn: () => myPoints(memberId) });
  const p = q.data;
  if (!p?.on) return null;
  return (
    <Card>
      <InfoRow label={t('gymPoints.title')} value={count(p.balance, lang)} strong />
      {p.expiringIn30Days > 0 ? <ThemedText type="small">{t('gymPoints.expiring', { n: count(p.expiringIn30Days, lang) })}</ThemedText> : null}
      {p.earn ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('gymPoints.earn', { visit: count(p.earn.perCheckin, lang), bonus: count(p.earn.streakBonus, lang), days: count(p.earn.streakDays, lang), friend: count(p.earn.referral, lang) })}
        </ThemedText>
      ) : null}
      {p.rewards
        .filter((r) => r.status === 'active')
        .map((r) => (
          <InfoRow key={r.id} label={r.title} value={t('gymPoints.pts', { n: count(r.points, lang) })} />
        ))}
      {p.rewards.some((r) => r.status === 'active') ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('gymPoints.redeem')}
        </ThemedText>
      ) : null}
    </Card>
  );
}

const BLOOD: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const numberOrNull = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')));

/**
 * My body (M27-FR-30): height and weight give the BMI the trainer plans with; blood group and
 * conditions are optional. Only I, the gym owner and the trainer who writes my plans see them.
 */
export function BodyCard({ memberId, health }: { memberId: string; health: Health }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [now, setNow] = useState(health);
  const [height, setHeight] = useState(health.heightCm != null ? String(health.heightCm) : '');
  const [weight, setWeight] = useState(health.weightKg != null ? String(health.weightKg) : '');
  const [blood, setBlood] = useState<BloodGroup | null>(health.bloodGroup ?? null);
  const [medical, setMedical] = useState(health.medical ?? '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const h = numberOrNull(height);
  const w = numberOrNull(weight);
  const bad = (h !== null && (!Number.isInteger(h) || h < 50 || h > 250)) || (w !== null && (!Number.isFinite(w) || w < 10 || w > 400));
  const save = async () => {
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      setNow(await saveHealth(memberId, { heightCm: h, weightKg: w, bloodGroup: blood, medical: medical.trim() || null }));
      setSaved(true);
      void qc.invalidateQueries({ queryKey: keys.gymMembership(memberId) });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <ThemedText type="smallBold">{t('gymBody.title')}</ThemedText>
      {now.bmi ? <ThemedText style={styles.bmi}>{t('gymBody.bmi', { value: now.bmi.value, band: t(`gymBody.band.${now.bmi.band as 'under'}`) })}</ThemedText> : null}
      <ThemedText type="small" themeColor="textSecondary">
        {t('gymBody.lead')}
      </ThemedText>
      <View style={styles.two}>
        <View style={{ flex: 1 }}>
          <Field label={t('gymBody.height')} value={height} onChangeText={(v) => setHeight(v.replace(/[^0-9]/g, '').slice(0, 3))} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t('gymBody.weight')} value={weight} onChangeText={(v) => setWeight(v.replace(/[^0-9.,]/g, '').slice(0, 5))} keyboardType="decimal-pad" />
        </View>
      </View>
      {bad ? <Notice tone="error" text={t('gymBody.range')} /> : null}
      <ThemedText type="smallBold">{t('gymBody.blood')}</ThemedText>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t('gymBody.blood')}>
        {BLOOD.map((b) => {
          const on = b === blood;
          return (
            <Pressable
              key={b}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => setBlood(on ? null : b)}
              style={[styles.chip, { borderColor: on ? theme.brand : theme.line, backgroundColor: on ? theme.brand : theme.backgroundElement }]}>
              <ThemedText type="smallBold" style={{ color: on ? theme.onBrand : theme.text }}>
                {b}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      <Field label={t('gymBody.medical')} value={medical} onChangeText={(v) => setMedical(v.slice(0, 500))} multiline numberOfLines={3} maxLength={500} hint={t('gymBody.private')} />
      {saved ? <Notice text={t('gymBody.saved')} /> : null}
      <ErrorNotice error={error} />
      <Button title={t('gymBody.save')} variant="outline" busy={busy} disabled={bad} onPress={() => void save()} />
    </Card>
  );
}

/** A gym page's class timetable (M27-FR-67): the week's sessions with the places left. Hidden when there are none. */
export function Timetable({ slug }: { slug: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const q = useQuery({ queryKey: ['gym-timetable', slug], queryFn: () => gymTimetable(slug), retry: false, staleTime: 60_000 });
  const days = byDay(q.data?.items ?? []);
  if (!days.length) return null;
  return (
    <View style={{ gap: 8 }}>
      <SectionTitle>{t('gymPage.timetable')}</SectionTitle>
      <Card>
        {days.map((d) => (
          <View key={d.date} style={{ gap: 2 }}>
            <ThemedText type="smallBold">{dateOnly(d.date, lang, { weekday: true, year: false })}</ThemedText>
            {d.items.map((s) => (
              <ThemedText key={s.id} type="small" themeColor="textSecondary">
                {timeOnly(s.startsAt, lang)} · {[s.name, s.trainer?.displayName].filter(Boolean).join(' · ')} · {s.spaces > 0 ? t('gymClasses.spaces', { n: count(s.spaces, lang) }) : t('gymClasses.full')}
              </ThemedText>
            ))}
          </View>
        ))}
        <ThemedText type="small" themeColor="textSecondary">
          {t('gymPage.timetableNote')}
        </ThemedText>
      </Card>
    </View>
  );
}

/** "Try the gym once for free" on a gym's page (M24-FR-110): only while the gym takes free visits. */
export function VisitCta({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['gym-visit-slots', slug], queryFn: () => visitSlots(slug), retry: false, staleTime: 60_000 });
  if (!q.data?.open) return null;
  return (
    <Card>
      <ThemedText type="smallBold">{t('gymVisit.cta')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t('gymVisit.ctaLead')}
      </ThemedText>
      <Button title={t('gymVisit.ctaButton')} variant="outline" onPress={() => router.push({ pathname: '/gym/visit', params: { slug } })} />
    </Card>
  );
}

const styles = StyleSheet.create({
  bmi: { fontSize: 20, lineHeight: 28, fontWeight: '800' },
  two: { flexDirection: 'row', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minWidth: 56, minHeight: 44, paddingHorizontal: 12, borderRadius: Radius.control, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
