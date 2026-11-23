import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, Switch, View } from 'react-native';
import { InfoRow, SectionTitle } from '@/components/esports';
import { Icon } from '@/components/icons/Icon';
import { Card, ErrorNotice } from '@/components/gym';
import { ThemedText } from '@/components/themed-text';
import { Avatar, Button, Field, Notice } from '@/components/ui';
import { Radius } from '@/constants/motion';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/esports-api';
import { count, type Lang } from '@/lib/format';
import { byDay, dateOnly, timeOnly } from '@/lib/gym';
import { gymTimetable, myGymWhatsapp, myPoints, saveGymWhatsapp, saveHealth, visitSlots, type BloodGroup, type Health, type MembershipTrainer, type MyGymWhatsapp } from '@/lib/gym-api';
import { initials } from '@/lib/ui-logic';
import { keys } from '@/lib/use-realtime';
import { classMessage, localMobile, needsReconsent, numberToSave, waUrl } from '@/lib/whatsapp';
import { displayFace } from '@/constants/fonts';

/**
 * The newer parts of the gym screens (M27 rounds 1 and 2, M24 §17): my points and the gym's rewards,
 * my body (height, weight, BMI, blood group), and on a gym's page the class timetable and the
 * free-visit card; WhatsApp chat buttons and my WhatsApp consents (M24-FR-158, FR-159). Each reads its
 * own data and hides when the gym's plan does not have the feature.
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

/** "Your trainer" (23 Nov 2026): the gym staff trainer assigned to me, with a photo or, without one, the initials. */
export function TrainerCard({ trainer }: { trainer: MembershipTrainer }) {
  const { t } = useTranslation();
  return (
    <Card>
      <ThemedText type="smallBold">{t('gymMember.trainerTitle')}</ThemedText>
      <View style={styles.trainerRow} testID="gym-member-trainer">
        {trainer.avatarUrl ? (
          <Image
            source={{ uri: trainer.avatarUrl }}
            style={styles.trainerPhoto}
            contentFit="cover"
            transition={200}
            accessibilityLabel={t('gymMember.trainerPhoto', { name: trainer.displayName })}
          />
        ) : (
          <Avatar letters={initials(trainer.displayName)} size={48} />
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText type="smallBold">{trainer.displayName}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('gymMember.trainerHint')}
          </ThemedText>
        </View>
      </View>
    </Card>
  );
}

const BLOOD: BloodGroup[] =['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
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

/** Opens a wa.me chat; the https link opens WhatsApp, or the browser when WhatsApp is not installed. */
export const openWhatsapp = (url: string) => void Linking.openURL(url).catch(() => undefined);

/**
 * A WhatsApp chat button (M24-FR-158): `label` shown next to the logo, or only the logo (`compact`,
 * 44×44) with the label read out. Renders nothing when the number is not a Bangladesh mobile.
 */
export function WhatsAppButton({ number, text, label, hint, compact, testID }: { number: string | null | undefined; text: string; label: string; hint?: string; compact?: boolean; testID?: string }) {
  const theme = useTheme();
  const url = waUrl(number, text);
  if (!url) return null;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint={hint}
      hitSlop={compact ? 4 : undefined}
      onPress={() => openWhatsapp(url)}
      style={({ pressed }) => [
        compact ? styles.waCompact : styles.waButton,
        { borderColor: theme.brand, backgroundColor: compact ? 'transparent' : theme.brandSoft, opacity: pressed ? 0.7 : 1 },
      ]}>
      <Icon name="whatsapp" size={compact ? 22 : 20} color={theme.brandText} />
      {compact ? null : (
        <ThemedText type="smallBold" style={{ color: theme.brandText }}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

/**
 * A gym page's class timetable (M27-FR-67): the week's sessions with the places left. Hidden when there
 * are none. With the gym's WhatsApp number, each class has an "Ask on WhatsApp" button (M24-FR-158).
 */
export function Timetable({ slug, gymName, whatsapp }: { slug: string; gymName?: string; whatsapp?: string | null }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const q = useQuery({ queryKey: ['gym-timetable', slug], queryFn: () => gymTimetable(slug), retry: false, staleTime: 60_000 });
  const days = byDay(q.data?.items ?? []);
  if (!days.length) return null;
  const chat = gymName && waUrl(whatsapp) ? { gym: gymName, number: whatsapp } : null;
  return (
    <View style={{ gap: 8 }}>
      <SectionTitle>{t('gymPage.timetable')}</SectionTitle>
      <Card>
        {days.map((d) => (
          <View key={d.date} style={{ gap: 2 }}>
            <ThemedText type="smallBold">{dateOnly(d.date, lang, { weekday: true, year: false })}</ThemedText>
            {d.items.map((s) => (
              <View key={s.id} style={styles.classRow}>
                <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
                  {timeOnly(s.startsAt, lang)} · {[s.name, s.trainer?.displayName].filter(Boolean).join(' · ')} · {s.spaces > 0 ? t('gymClasses.spaces', { n: count(s.spaces, lang) }) : t('gymClasses.full')}
                </ThemedText>
                {chat ? (
                  <WhatsAppButton
                    compact
                    testID="class-whatsapp"
                    number={chat.number}
                    text={classMessage({ gym: chat.gym, name: s.name, localDate: s.localDate, startsAt: s.startsAt }, lang)}
                    label={t('gymWhatsapp.askClass', { gym: chat.gym, name: s.name })}
                    hint={t('gymWhatsapp.chatHint', { gym: chat.gym })}
                  />
                ) : null}
              </View>
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

/**
 * WhatsApp from this gym (M24-FR-159, step 1): my WhatsApp number (my phone in the gym's record when
 * left empty) and what I agree to receive: receipts and reminders, news and offers, each off until I
 * turn it on. Hidden when the API has no such record for me (404). The gym sending these is a later
 * step; saving here only records my choice.
 */
export function WhatsAppCard({ memberId }: { memberId: string }) {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['gym', 'whatsapp', memberId], queryFn: () => myGymWhatsapp(memberId), retry: false });
  if (q.data) return <WhatsAppForm key={memberId} memberId={memberId} initial={q.data} />;
  if (!q.error || (q.error instanceof ApiError && q.error.status === 404)) return null;
  return (
    <Card>
      <ThemedText type="smallBold">{t('gymWhatsapp.title')}</ThemedText>
      <ErrorNotice error={q.error} onRetry={() => void q.refetch()} />
    </Card>
  );
}

/** The field a 422 points at (problem+json `errors[0].field`). */
const fieldOf = (e: unknown) => {
  if (!(e instanceof ApiError)) return null;
  const errors = e.problem.errors;
  const first = Array.isArray(errors) ? (errors[0] as { field?: unknown } | undefined) : undefined;
  return typeof first?.field === 'string' ? first.field : null;
};

function WhatsAppForm({ memberId, initial }: { memberId: string; initial: MyGymWhatsapp }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [now, setNow] = useState(initial);
  const [draft, setDraft] = useState(localMobile(initial.number ?? initial.phone));
  const [service, setService] = useState(initial.service);
  const [news, setNews] = useState(initial.news);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const parsed = numberToSave(draft, now.phone);
  const badNumber = !parsed.ok || fieldOf(error) === 'number';
  const phone = localMobile(now.phone);
  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setSaved(false);
    setError(null);
  };

  const save = async () => {
    if (!parsed.ok) return;
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      const next = await saveGymWhatsapp(memberId, { number: parsed.number, service, news });
      setNow(next);
      setDraft(localMobile(next.number ?? next.phone));
      setService(next.service);
      setNews(next.news);
      setSaved(true);
      qc.setQueryData(['gym', 'whatsapp', memberId], next);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const suspended = error instanceof ApiError && error.code === 'GYM_SUSPENDED';
  return (
    <Card>
      <View style={styles.waHead}>
        <Icon name="whatsapp" size={22} color={theme.brandText} />
        <ThemedText type="smallBold" style={{ flex: 1 }}>
          {t('gymWhatsapp.title')}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {t('gymWhatsapp.lead', { gym: now.gymName })}
      </ThemedText>
      {needsReconsent(now) ? <Notice text={t('gymWhatsapp.reconsent')} /> : null}
      {now.source === 'stop_reply' ? <Notice text={t('gymWhatsapp.stopped')} /> : null}
      <Field
        testID="wa-number"
        label={t('gymWhatsapp.number')}
        value={draft}
        onChangeText={touch((v: string) => setDraft(v.replace(/[^0-9০-৯+\s-]/g, '').slice(0, 17)))}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        placeholder="01XXXXXXXXX"
        errorText={badNumber ? t('gymWhatsapp.numberBad') : null}
        hint={phone ? t('gymWhatsapp.numberHint', { phone }) : t('gymWhatsapp.numberHintNoPhone')}
      />
      <ConsentSwitch testID="wa-service" title={t('gymWhatsapp.service')} lead={t('gymWhatsapp.serviceLead')} value={service} onChange={touch(setService)} />
      <ConsentSwitch testID="wa-news" title={t('gymWhatsapp.news')} lead={t('gymWhatsapp.newsLead')} value={news} onChange={touch(setNews)} />
      <ThemedText type="small" themeColor="textSecondary">
        {t('gymWhatsapp.stopNote')}
      </ThemedText>
      {saved ? <Notice text={t('gymWhatsapp.saved')} /> : null}
      {suspended ? <Notice tone="error" text={t('gymWhatsapp.suspended')} /> : fieldOf(error) === 'number' ? null : <ErrorNotice error={error} />}
      <Button testID="wa-save" title={t('gymWhatsapp.save')} variant="outline" busy={busy} disabled={!parsed.ok} onPress={() => void save()} />
    </Card>
  );
}

/** One consent: the whole row (at least 56 high) toggles it and is read out as one switch. */
function ConsentSwitch({ title, lead, value, onChange, testID }: { title: string; lead: string; value: boolean; onChange: (v: boolean) => void; testID?: string }) {
  const theme = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole="switch" accessibilityLabel={title} accessibilityHint={lead} accessibilityState={{ checked: value }} onPress={() => onChange(!value)} style={styles.switchRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {lead}
        </ThemedText>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.lineStrong, true: theme.brand }}
        thumbColor={theme.backgroundElement}
        ios_backgroundColor={theme.lineStrong}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  waButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 16, borderWidth: 1.5, borderRadius: Radius.pill },
  waCompact: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: Radius.pill },
  classRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  waHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trainerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  trainerPhoto: { width: 48, height: 48, borderRadius: 24 },
  switchRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  bmi: { ...displayFace, fontSize: 20, lineHeight: 28 },
  two: { flexDirection: 'row', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minWidth: 56, minHeight: 44, paddingHorizontal: 12, borderRadius: Radius.control, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
