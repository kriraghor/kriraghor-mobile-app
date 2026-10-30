import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Pill, SectionTitle } from '@/components/esports';
import { Card, ErrorNotice } from '@/components/gym';
import { ThemedText } from '@/components/themed-text';
import { Button, EmptyState, Field, Notice, Reveal, SkeletonList } from '@/components/ui';
import { Radius } from '@/constants/motion';
import { useTheme } from '@/hooks/use-theme';
import i18n from '@/i18n';
import { useAuth } from '@/lib/auth';
import { ApiError, idempotencyKey } from '@/lib/esports-api';
import { buyPass, gymPage, joinGym, type GymPage } from '@/lib/gym-api';
import { joinablePackages, joinState, passDates, ratingText, weekOf } from '@/lib/gym-directory';
import { addDays, dateOnly } from '@/lib/gym';
import { count, money, type Lang } from '@/lib/format';
import { useGate } from '@/lib/use-gate';
import { useMyGyms, usePendingRequests } from '@/lib/use-gym';
import { keys } from '@/lib/use-realtime';

/**
 * A gym's page (M20 §4, gym.kriraghor.com /gyms/[slug]), open to guests: photos, open now, rating,
 * address and map, facilities, the week's hours (Saturday first, women-only windows), the passes.
 * Buy a pass and Join this gym ask for a sign-in only when tapped and carry on afterwards; both need
 * a verified phone (PHONE_REQUIRED shows the verify path), never NID.
 */
export default function GymPageScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const q = useQuery({ queryKey: ['gym-page', slug], queryFn: () => gymPage(slug), retry: false });

  if (q.isLoading) return <SkeletonList rows={3} height={180} label={t('common.loading')} />;
  if (q.error instanceof ApiError && q.error.status === 404) return <EmptyState text={t('gymPage.notFound')} action={{ title: t('gymPage.back'), onPress: () => router.replace('/gyms') }} />;
  if (!q.data)
    return (
      <View style={{ flex: 1, padding: 16, backgroundColor: theme.background }}>
        <ErrorNotice error={q.error} onRetry={() => void q.refetch()} />
      </View>
    );
  const g = q.data;
  return (
    <>
      <Stack.Screen options={{ title: g.name }} />
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.page}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={theme.brand} />}>
        <Photos g={g} />
        <Reveal index={1} style={styles.section}>
          <About g={g} />
        </Reveal>
        <Reveal index={2} style={styles.section}>
          <BuyPass g={g} />
        </Reveal>
        <Reveal index={3} style={styles.section}>
          <Join g={g} />
        </Reveal>
        <Reveal index={4} style={styles.section}>
          <Hours g={g} />
        </Reveal>
      </ScrollView>
    </>
  );
}

function Photos({ g }: { g: GymPage }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const photos = g.photos.length ? g.photos.map((p) => p.url) : g.cover ? [g.cover] : [];
  if (!photos.length) return <View style={[styles.noPhoto, { backgroundColor: theme.backgroundSelected }]} />;
  return (
    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
      {photos.map((url, i) => (
        <Image key={url} source={{ uri: url }} style={{ width, aspectRatio: 16 / 9 }} contentFit="cover" transition={200} accessibilityLabel={t('gymPage.photo', { n: i + 1, name: g.name })} />
      ))}
    </ScrollView>
  );
}

function About({ g }: { g: GymPage }) {
  const theme = useTheme();
  const { t, i18n: i } = useTranslation();
  const lang = i.language as Lang;
  const rating = ratingText(g.ratingAvg, g.ratingCount);
  const name = (x: { nameEn: string; nameBn: string }) => (lang === 'bn' ? x.nameBn : x.nameEn);
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.row}>
        <Pill text={g.openNow ? t('gymDir.openNow') : t('gymDir.closedNow')} tone={g.openNow ? 'brand' : 'neutral'} />
        <MaterialCommunityIcons name="star" size={16} color={theme.prize} />
        <ThemedText type="small" themeColor="textSecondary">
          {rating ? t('gymDir.rating', { avg: rating, n: count(g.ratingCount, lang) }) : t('gymDir.newGym')}
        </ThemedText>
      </View>
      <ThemedText style={styles.title} accessibilityRole="header">
        {g.name}
      </ThemedText>
      <ThemedText themeColor="textSecondary">
        {g.addressLine}
        {g.area ? `, ${name(g.area)}` : ''}
      </ThemedText>
      {g.lat !== null && g.lng !== null ? (
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${g.lat},${g.lng}`)} style={styles.link}>
          <MaterialCommunityIcons name="map-marker-outline" size={18} color={theme.brandText} />
          <ThemedText type="smallBold" style={{ color: theme.brandText }}>
            {t('gymPage.map')}
          </ThemedText>
        </Pressable>
      ) : null}
      {g.about ? <ThemedText>{g.about}</ThemedText> : null}
      {g.facilities.length ? (
        <>
          <SectionTitle>{t('gymPage.facilities')}</SectionTitle>
          <View style={[styles.row, { gap: 8 }]}>
            {g.facilities.map((f) => (
              <View key={f.id} style={[styles.tag, { borderColor: theme.line, backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="small">{name(f)}</ThemedText>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

/** Buy a pass: pick a pass and a date; Pay starts the payment (sign-in first for a guest). */
function BuyPass({ g }: { g: GymPage }) {
  const theme = useTheme();
  const { t, i18n: i } = useTranslation();
  const lang = i.language as Lang;
  const gate = useGate();
  const { status } = useAuth();
  const [packageId, setPackageId] = useState(g.packages[0]?.id);
  const pkg = g.packages.find((p) => p.id === packageId) ?? g.packages[0];
  const dates = pkg ? passDates(pkg.kind, g.hours, g.today, g.advanceDays) : [];
  const [picked, setPicked] = useState<string | undefined>();
  const date = picked && dates.includes(picked) ? picked : dates[0];
  // A new Idempotency-Key per choice: a retry of the same choice replays, a new choice is a new pass.
  const [key, setKey] = useState(() => idempotencyKey('gympass'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const choose = (fn: () => void) => {
    fn();
    setKey(idempotencyKey('gympass'));
    setError(null);
  };

  if (!g.taking || !pkg) {
    return (
      <Card>
        <ThemedText type="smallBold">{t('gymPage.buyTitle')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('gymPage.notSelling')}
        </ThemedText>
      </Card>
    );
  }

  const buy = async () => {
    if (!date) return;
    setBusy(true);
    setError(null);
    try {
      const r = await buyPass(pkg.id, date, key);
      if (r.payment) router.push({ pathname: '/pay/[paymentId]', params: { paymentId: r.payment.id } });
      else router.navigate({ pathname: '/gym/passes', params: { code: r.pass.code } });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const known = error instanceof ApiError && i18n.exists(`gymPage.errors.${error.code}`) ? t(`gymPage.errors.${error.code}` as never) : null;

  return (
    <Card>
      <ThemedText style={styles.h2}>{t('gymPage.buyTitle')}</ThemedText>
      <View style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={t('gymPage.pickPackage')}>
        {g.packages.map((p) => {
          const on = p.id === pkg.id;
          return (
            <Pressable
              key={p.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => choose(() => setPackageId(p.id))}
              style={[styles.option, { borderColor: on ? theme.brand : theme.line, backgroundColor: on ? theme.backgroundSelected : theme.backgroundElement }]}>
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold">{t(`gymPage.kind.${p.kind}`)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {p.kind === 'day' ? t('gymPage.oneVisit') : t('gymPage.forDays', { n: count(p.days, lang) })}
                </ThemedText>
              </View>
              <ThemedText style={styles.price}>{money(p.price, lang)}</ThemedText>
            </Pressable>
          );
        })}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {pkg.kind === 'day' ? t('gymPage.pickDay') : t('gymPage.pickStart')}
      </ThemedText>
      {dates.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityRole="radiogroup">
          {dates.map((d) => {
            const on = d === date;
            return (
              <Pressable
                key={d}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => choose(() => setPicked(d))}
                style={[styles.chip, { borderColor: on ? theme.brand : theme.line, backgroundColor: on ? theme.brand : theme.backgroundElement }]}>
                <ThemedText type="smallBold" style={{ color: on ? theme.onBrand : theme.text }}>
                  {d === g.today ? t('gymPage.today') : dateOnly(d, lang, { weekday: true, year: false })}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {t('gymPage.noOpenDays')}
        </ThemedText>
      )}
      {pkg.kind !== 'day' && date ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('gymPage.validUntil', { date: dateOnly(addDays(date, pkg.days - 1), lang) })}
        </ThemedText>
      ) : null}
      <View style={[styles.total, { borderTopColor: theme.line }]}>
        <ThemedText type="smallBold">{t('gymPage.total')}</ThemedText>
        <ThemedText style={styles.price}>{money(pkg.price, lang)}</ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {t('gymPage.refundRule')}
      </ThemedText>
      {status !== 'signed_in' ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('gymPage.signInToBuy')}
        </ThemedText>
      ) : null}
      {known ? <Notice tone="error" text={known} /> : <ErrorNotice error={error} />}
      <Button title={t('gymPage.payNow', { price: money(pkg.price, lang) })} busy={busy} disabled={!date} onPress={() => gate('buy_pass', () => void buy())} />
    </Card>
  );
}

/** Join this gym (M24-FR-16): shown while the gym takes join requests; a member or a waiting request sees that instead. */
function Join({ g }: { g: GymPage }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const gate = useGate();
  const { status } = useAuth();
  const gyms = useMyGyms();
  const pending = usePendingRequests();
  const [packageId, setPackageId] = useState<string | undefined>();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const theme = useTheme();

  if (!g.joinRequestsOpen) {
    return (
      <Card>
        <ThemedText type="smallBold">{t('gymPage.joinCta')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('gymPage.joinClosed')}
        </ThemedText>
      </Card>
    );
  }
  const state = status === 'signed_in' ? joinState(g.id, gyms.data?.items, pending.data) : ({ kind: 'open' } as const);
  if (state.kind === 'member')
    return (
      <Card>
        <Notice text={t('gymPage.alreadyMember')} />
        <Button title={t('gymPage.openMembership')} variant="outline" onPress={() => router.push({ pathname: '/gym/[memberId]', params: { memberId: state.memberId } })} />
      </Card>
    );
  if (state.kind === 'pending' || sent)
    return (
      <Card>
        <Notice text={sent ? t('gymPage.joinSent') : t('gymPage.pending')} />
        <Button title={t('gymPage.seeRequest')} variant="outline" onPress={() => router.push('/gym/requests')} />
      </Card>
    );

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await joinGym({ gymId: g.id, ...(packageId ? { packageId } : {}), ...(note.trim() ? { note: note.trim().slice(0, 300) } : {}) });
      setSent(true);
      void qc.invalidateQueries({ queryKey: keys.gym });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const known = error instanceof ApiError && i18n.exists(`gymPage.errors.${error.code}`) ? t(`gymPage.errors.${error.code}` as never) : null;
  const online = joinablePackages(g.packages);

  return (
    <Card>
      <ThemedText style={styles.h2}>{t('gymPage.joinCta')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t('gymPage.joinLead')}
      </ThemedText>
      {online.length ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {t('gymPage.joinPackage')}
          </ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityRole="radiogroup">
            {[{ id: '', title: t('gymPage.joinNoPackage') }, ...online].map((p) => {
              const on = (packageId ?? '') === p.id;
              return (
                <Pressable
                  key={p.id || 'none'}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  onPress={() => setPackageId(p.id || undefined)}
                  style={[styles.chip, { borderColor: on ? theme.brand : theme.line, backgroundColor: on ? theme.brand : theme.backgroundElement }]}>
                  <ThemedText type="smallBold" style={{ color: on ? theme.onBrand : theme.text }}>
                    {p.title}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      ) : null}
      <Field label={t('gymPage.joinNote')} value={note} onChangeText={(v) => setNote(v.slice(0, 300))} placeholder={t('gymPage.joinNotePlaceholder')} multiline maxLength={300} />
      <ThemedText type="small" themeColor="textSecondary">
        {t('gymPage.joinConsent')}
      </ThemedText>
      {known ? <Notice tone="error" text={known} /> : <ErrorNotice error={error} />}
      <Button title={t('gymPage.joinSend')} variant="outline" busy={busy} onPress={() => gate('join_gym', () => void send())} />
    </Card>
  );
}

function Hours({ g }: { g: GymPage }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const today = new Date(`${g.today}T00:00:00Z`).getUTCDay();
  return (
    <View style={{ gap: 4 }}>
      <SectionTitle>{t('gymPage.hours')}</SectionTitle>
      {weekOf(g.hours).map((d) => (
        <View key={d.dow} style={[styles.hourRow, { borderBottomColor: theme.line }]}>
          <ThemedText type={d.dow === today ? 'smallBold' : 'small'} style={{ width: 110 }}>
            {t(`gymPage.days.d${d.dow}` as never)}
          </ThemedText>
          <View style={{ flex: 1, gap: 2 }}>
            {d.windows.length ? (
              d.windows.map((w) => (
                <ThemedText key={w.openTime} type={d.dow === today ? 'smallBold' : 'small'}>
                  {w.openTime}–{w.closeTime}
                  {w.womenOnly ? ` · ${t('gymDir.womenOnly')}` : ''}
                </ThemedText>
              ))
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                {t('gymPage.closed')}
              </ThemedText>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 40 },
  section: { paddingHorizontal: 16, paddingTop: 16 },
  noPhoto: { width: '100%', aspectRatio: 16 / 9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  title: { fontSize: 28, lineHeight: 36, fontWeight: '800' },
  h2: { fontSize: 20, lineHeight: 28, fontWeight: '800' },
  link: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  tag: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  option: { minHeight: 56, borderWidth: 1.5, borderRadius: Radius.control, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  chip: { minHeight: 48, paddingHorizontal: 16, borderRadius: Radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  price: { fontSize: 18, lineHeight: 26, fontWeight: '800' },
  total: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', borderTopWidth: 1, paddingTop: 12 },
  hourRow: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: 1 },
});
