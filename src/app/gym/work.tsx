import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { InfoRow, Pill, SectionTitle, Segments } from '@/components/esports';
import { Card, ErrorNotice, GymGate, gymWeb, openWeb, RowLink } from '@/components/gym';
import { ThemedText } from '@/components/themed-text';
import { Button, EmptyState, Notice } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { count, money, type Lang } from '@/lib/format';
import { clockTime, entranceTokenFrom, hoursMinutes, monthTitle, timeOnly } from '@/lib/gym';
import { myClock, myPayslips, staffClock, type StaffClocked } from '@/lib/gym-api';
import { useClockWorkplaces } from '@/lib/use-gym';
import { keys } from '@/lib/use-realtime';
import { Radius } from '@/constants/motion';
import { displayFace } from '@/constants/fonts';

const NATIVE = Platform.OS !== 'web';
/** The same code seen again within this time is the same scan (the camera reports a QR many times a second). */
const SCAN_REPEAT_MS = 3000;

/**
 * My work (M27-FR-73, FR-75, FR-81; mirrors gym.kriraghor.com /manage/[gymId]/my-work): for staff of a
 * gym who clock themselves in. Scanning the gym's entrance QR clocks me in, or out when I am in; the
 * screen shows whether I am in, today's shifts, this month's time and my payslips. Everything else a
 * staff member does (the desk, fees, classes) stays on gym.kriraghor.com.
 */
export default function GymWorkScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const { status } = useAuth();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ g?: string }>();
  const places = useClockWorkplaces();
  const [chosen, setChosen] = useState<string | null>(params.g ?? null);
  const gym = places.items.find((g) => g.id === chosen) ?? places.items[0];
  const gymId = gym?.id ?? '';
  const clock = useQuery({ queryKey: keys.gymClock(gymId), queryFn: () => myClock(gymId), enabled: status === 'signed_in' && !!gymId });
  const slips = useQuery({ queryKey: keys.gymPayslips(gymId), queryFn: () => myPayslips(gymId), enabled: status === 'signed_in' && !!gymId });

  if (status !== 'signed_in' || places.isLoading) return <GymGate loading={places.isLoading} />;
  if (!gym) return <EmptyState icon="clock" text={t('gymWork.none')} />;

  const c = clock.data;
  const worked = hoursMinutes(c?.monthMinutes ?? 0);
  const refresh = () => (void clock.refetch(), void slips.refetch());
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={clock.isRefetching || slips.isRefetching} onRefresh={refresh} tintColor={theme.brand} />}>
      {places.items.length > 1 ? (
        <View style={{ marginHorizontal: -16 }}>
          <Segments items={places.items.map((g) => ({ key: g.id, label: g.name }))} value={gym.id} onChange={setChosen} />
        </View>
      ) : (
        <ThemedText style={styles.title}>{gym.name}</ThemedText>
      )}
      <ErrorNotice error={clock.error} onRetry={() => void clock.refetch()} />

      {c ? (
        <Card>
          <View style={styles.head}>
            <ThemedText type="smallBold" style={{ flex: 1, fontSize: 16 }}>
              {c.clockedIn && c.since ? t('gymWork.inSince', { time: timeOnly(c.since, lang) }) : t('gymWork.notIn')}
            </ThemedText>
            <Pill text={c.clockedIn ? t('gymWork.in') : t('gymWork.out')} tone={c.clockedIn ? 'brand' : 'neutral'} />
          </View>
          <InfoRow
            label={t('gymWork.today')}
            value={c.todayShifts.length ? c.todayShifts.map((s) => `${clockTime(s.startTime, lang)} – ${clockTime(s.endTime, lang)}`).join(', ') : t('gymWork.noShift')}
          />
          <InfoRow label={t('gymWork.month')} value={t('gymWork.worked', { h: count(worked.h, lang), m: count(worked.m, lang) })} />
          {c.today.map((x) => (
            <ThemedText key={x.id} type="small" themeColor="textSecondary">
              {timeOnly(x.at, lang)} · {t(`gymWork.kind.${x.kind}`)} · {t(`gymWork.method.${x.method}`)}
            </ThemedText>
          ))}
        </Card>
      ) : null}

      <ClockScan clockedIn={!!c?.clockedIn} onClocked={() => void qc.invalidateQueries({ queryKey: keys.gymClock(gymId) })} />

      <SectionTitle>{t('gymWork.payslips')}</SectionTitle>
      <ErrorNotice error={slips.error} onRetry={() => void slips.refetch()} />
      {!slips.isLoading && !slips.error && !(slips.data ?? []).length ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('gymWork.noPayslips')}
        </ThemedText>
      ) : null}
      {(slips.data ?? []).map((p) => (
        <Card key={p.lineId}>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <ThemedText type="smallBold">{monthTitle(p.period, lang)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {money(p.netPoisha, lang)}
              </ThemedText>
            </View>
            <Pill text={t(`gymWork.slip.${p.status}`)} tone={p.status === 'paid' ? 'brand' : 'neutral'} />
          </View>
        </Card>
      ))}

      <RowLink icon="gym" external label={t('gymWork.openDesk')} hint={t('gymWork.openDeskHint')} onPress={() => openWeb(gymWeb(`/manage/${gym.id}`))} />
    </ScrollView>
  );
}

type Result = { ok: true; c: StaffClocked } | { ok: false; error: unknown; message?: string };

/** The camera on the gym's entrance QR: one scan clocks me in, the next one out (the server decides which). */
function ClockScan({ clockedIn, onClocked }: { clockedIn: boolean; onClocked: () => void }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const [perm, requestPerm] = useCameraPermissions();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const last = useRef<{ data: string; at: number } | null>(null);
  const sending = useRef(false);

  // Leaving the screen turns the camera off.
  useFocusEffect(useCallback(() => () => setOn(false), []));
  useEffect(() => () => setOn(false), []);

  const start = async () => {
    setResult(null);
    last.current = null;
    if (perm?.granted) return setOn(true);
    const next = await requestPerm();
    if (next.granted) setOn(true);
  };

  const onScanned = async ({ data }: BarcodeScanningResult) => {
    const at = Date.now();
    if (sending.current || (last.current && last.current.data === data && at - last.current.at < SCAN_REPEAT_MS)) return;
    last.current = { data, at };
    const token = entranceTokenFrom(data);
    if (!token) return setResult({ ok: false, error: null, message: t('gymCheckin.notEntrance') });
    sending.current = true;
    setBusy(true);
    setOn(false);
    try {
      setResult({ ok: true, c: await staffClock(token) });
      onClocked();
    } catch (err) {
      setResult({ ok: false, error: err });
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  if (!NATIVE) return <Notice text={t('gymCheckin.webNoCamera')} />;

  const denied = perm && !perm.granted && !perm.canAskAgain;
  const done = result?.ok ? result.c : null;
  const spent = done?.minutes != null ? hoursMinutes(done.minutes) : null;
  return (
    <View style={{ gap: 12 }}>
      {done ? (
        <Card style={{ borderColor: theme.brand, borderWidth: 2 }}>
          <ThemedText type="smallBold" style={{ fontSize: 16 }}>
            {t(done.kind === 'in' ? 'gymWork.clockedIn' : 'gymWork.clockedOut', { time: timeOnly(done.at, lang) })}
          </ThemedText>
          {spent ? <ThemedText type="small">{t('gymWork.worked', { h: count(spent.h, lang), m: count(spent.m, lang) })}</ThemedText> : null}
        </Card>
      ) : null}
      {result && !result.ok ? result.message ? <Notice tone="error" text={result.message} /> : <ErrorNotice error={result.error} /> : null}
      {on ? (
        <>
          <View style={[styles.camera, { borderColor: theme.brand }]}>
            <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={(r) => void onScanned(r)} />
          </View>
          <Button title={t('gymCheckin.stop')} variant="outline" onPress={() => setOn(false)} />
        </>
      ) : denied ? (
        <Card>
          <ThemedText type="smallBold">{t('gymCheckin.cameraDenied')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('gymWork.cameraDeniedBody')}
          </ThemedText>
          <Button title={t('gymCheckin.openSettings')} variant="outline" onPress={() => void Linking.openSettings()} />
        </Card>
      ) : (
        <>
          <Button title={t(clockedIn ? 'gymWork.scanOut' : 'gymWork.scanIn')} busy={busy} onPress={() => void start()} />
          <ThemedText type="small" themeColor="textSecondary">
            {t('gymWork.scanHint')}
          </ThemedText>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12, paddingBottom: 40 },
  title: { ...displayFace, fontSize: 22, lineHeight: 30 },
  head: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  camera: { width: '100%', aspectRatio: 1, borderWidth: 3, overflow: 'hidden', backgroundColor: '#000000', borderRadius: Radius.card },
});
