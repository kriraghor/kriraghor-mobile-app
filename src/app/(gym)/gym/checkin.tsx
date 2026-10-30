import { Icon } from '@/components/icons/Icon';
import { useQueryClient } from '@tanstack/react-query';
import * as Brightness from 'expo-brightness';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Segments } from '@/components/esports';
import { Card, ErrorNotice, GymGate } from '@/components/gym';
import { ThemedText } from '@/components/themed-text';
import { Button, Notice } from '@/components/ui';
import { useTabBarInset } from '@/hooks/use-tab-bar-inset';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/esports-api';
import { entranceTokenFrom, linkedGyms, qrRefreshIn, secondsLeft, timeOnly } from '@/lib/gym';
import { checkinToken, entranceCheckin, type CheckinToken, type EntranceCheckin } from '@/lib/gym-api';
import { count, type Lang } from '@/lib/format';
import { useMyGyms } from '@/lib/use-gym';
import { keys } from '@/lib/use-realtime';

type Mode = 'qr' | 'scan';
const NATIVE = Platform.OS !== 'web';
/** The same code seen again within this time is the same scan (the camera reports a QR many times a second). */
const SCAN_REPEAT_MS = 3000;

/**
 * Check in (M24 §4.5 gym/checkin): my rotating member QR full screen for the front desk (M24-FR-50),
 * and scanning the gym's entrance QR with the camera (M24-FR-51). While my QR is shown the screen
 * stays awake and the app's brightness is raised, both put back on leaving. Camera denied → explain
 * and offer my QR instead. Camera and brightness need the phone app; the web build shows the QR only.
 */
export default function GymCheckin() {
  const theme = useTheme();
  const tabInset = useTabBarInset();
  const { t } = useTranslation();
  const { status } = useAuth();
  const params = useLocalSearchParams<{ m?: string; mode?: string }>();
  const gyms = useMyGyms();
  const [mode, setMode] = useState<Mode>(params.mode === 'scan' ? 'scan' : 'qr');
  const [chosen, setChosen] = useState<string | null>(params.m ?? null);
  // A tab stays mounted: a later link with another gym (?m=) or ?mode=scan switches to it.
  const [seen, setSeen] = useState({ m: params.m, mode: params.mode });
  if (seen.m !== params.m || seen.mode !== params.mode) {
    setSeen({ m: params.m, mode: params.mode });
    if (params.m) setChosen(params.m);
    if (params.mode === 'scan' || params.mode === 'qr') setMode(params.mode);
  }

  if (status !== 'signed_in' || gyms.isLoading) return <GymGate loading={gyms.isLoading} />;
  const linked = linkedGyms(gyms.data?.items ?? []);
  const member = linked.find((m) => m.memberId === chosen) ?? linked[0];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ paddingTop: 4 }}>
        <Segments
          items={[
            { key: 'qr' as Mode, label: t('gymCheckin.myQr') },
            { key: 'scan' as Mode, label: t('gymCheckin.scanTab') },
          ]}
          value={mode}
          onChange={setMode}
        />
      </View>
      <ScrollView contentContainerStyle={[styles.page, { paddingBottom: 24 + tabInset }]}>
        <ErrorNotice error={gyms.error} onRetry={() => void gyms.refetch()} />
        {!member && !gyms.error ? (
          <Card>
            <ThemedText type="smallBold">{t('gymCheckin.noLinked')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('gymCheckin.noLinkedBody')}
            </ThemedText>
            <Button title={t('gym.requests')} variant="outline" onPress={() => router.push('/gym/requests')} />
          </Card>
        ) : null}
        {member && linked.length > 1 ? (
          <View style={{ marginHorizontal: -16 }}>
            <Segments items={linked.map((m) => ({ key: m.memberId, label: m.gym?.name ?? m.memberCode }))} value={member.memberId} onChange={setChosen} />
          </View>
        ) : null}
        {member && mode === 'qr' ? <MyQr key={member.memberId} memberId={member.memberId} gym={member.gym?.name ?? ''} code={member.memberCode} /> : null}
        {member && mode === 'scan' ? <EntranceScan onShowQr={() => setMode('qr')} /> : null}
      </ScrollView>
    </View>
  );
}

/** Keeps the screen on while mounted (native only; the web build has no wake lock to rely on). */
function KeepAwake() {
  useKeepAwake('gym-checkin-qr');
  return null;
}

/**
 * My member QR (M24-FR-50): a token valid for one window (gym_manage.member_qr_seconds), no personal
 * data in it; the next one is fetched a few seconds before this one ends, only while the screen is in
 * front. Brightness goes to full on focus and back on blur or unmount.
 */
function MyQr({ memberId, gym, code }: { memberId: string; gym: string; code: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const { width } = useWindowDimensions();
  const [token, setToken] = useState<CheckinToken | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [now, setNow] = useState(() => Date.now());
  const [boxWidth, setBoxWidth] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const load = async () => {
        try {
          const tk = await checkinToken(memberId);
          if (!live) return;
          setToken(tk);
          setError(null);
          timer = setTimeout(load, qrRefreshIn(tk.expiresAt, Date.now(), tk.seconds));
        } catch (err) {
          if (!live) return;
          setError(err);
          // A refused QR (not linked any more) does not retry; a network failure does.
          if (!(err instanceof ApiError)) timer = setTimeout(load, 10_000);
        }
      };
      void load();
      const tick = setInterval(() => setNow(Date.now()), 1000);
      return () => {
        live = false;
        if (timer) clearTimeout(timer);
        clearInterval(tick);
      };
    }, [memberId]),
  );

  // Full brightness for the desk's scanner; the app window's brightness only (no system permission).
  useFocusEffect(
    useCallback(() => {
      if (!NATIVE) return undefined;
      let before: number | null = null;
      let done = false;
      void (async () => {
        try {
          before = await Brightness.getBrightnessAsync();
          if (!done) await Brightness.setBrightnessAsync(1);
        } catch {
          // Brightness is a nicety: the QR still works without it.
        }
      })();
      return () => {
        done = true;
        if (Platform.OS === 'android') void Brightness.restoreSystemBrightnessAsync().catch(() => undefined);
        else if (before !== null) void Brightness.setBrightnessAsync(before).catch(() => undefined);
      };
    }, []),
  );

  // The QR fits the white box it sits in (padding 16 each side, quiet zone 8 each side), up to 320.
  const size = Math.max(120, Math.min((boxWidth || width - 32) - 48, 320));
  const left = token ? secondsLeft(token.expiresAt, now) : 0;
  return (
    <View style={{ gap: 12 }}>
      {NATIVE ? <KeepAwake /> : null}
      <View style={styles.qrBox} onLayout={(e) => setBoxWidth(e.nativeEvent.layout.width)} accessible accessibilityLabel={t('gymCheckin.qrAlt', { gym })}>
        <ThemedText style={styles.qrGym} numberOfLines={2}>
          {gym}
        </ThemedText>
        {token ? <QRCode value={token.token} size={size} ecl="M" color="#111210" backgroundColor="#FFFFFF" quietZone={8} /> : <View style={{ width: size, height: size, backgroundColor: '#ECEBE6' }} />}
        <ThemedText style={styles.qrCode}>{code}</ThemedText>
        {token ? <ThemedText style={styles.qrHint}>{t('gymCheckin.refreshIn', { s: count(left, lang) })}</ThemedText> : null}
      </View>
      <ErrorNotice error={error} />
      <ThemedText type="small" themeColor="textSecondary">
        {t('gymCheckin.showDesk')}
      </ThemedText>
    </View>
  );
}

type Result = { ok: true; c: EntranceCheckin } | { ok: false; error: unknown; message?: string };

/**
 * Scan the gym's entrance QR (M24-FR-51): the camera reads the tablet's code (a link …/me/checkin?e=…
 * or the bare token), the app sends it once, and shows the answer: checked in, already checked in today,
 * a warning from the gym's entry rule, or the gym's refusal (block, expired code, not a member).
 */
function EntranceScan({ onShowQr }: { onShowQr: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const qc = useQueryClient();
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
      const c = await entranceCheckin(token);
      setResult({ ok: true, c });
      void qc.invalidateQueries({ queryKey: keys.gym });
    } catch (err) {
      setResult({ ok: false, error: err });
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  if (!NATIVE) return <Notice text={t('gymCheckin.webNoCamera')} />;

  const denied = perm && !perm.granted && !perm.canAskAgain;
  return (
    <View style={{ gap: 12 }}>
      <ThemedText type="small" themeColor="textSecondary">
        {t('gymCheckin.scanLead')}
      </ThemedText>
      {result?.ok ? <CheckinResult c={result.c} /> : null}
      {result && !result.ok ? <ScanError error={result.error} message={result.message} /> : null}
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
            {t('gymCheckin.cameraDeniedBody')}
          </ThemedText>
          <Button title={t('gymCheckin.showQrInstead')} onPress={onShowQr} />
          <Button title={t('gymCheckin.openSettings')} variant="outline" onPress={() => void Linking.openSettings()} />
        </Card>
      ) : (
        <>
          {perm && !perm.granted && perm.status === 'denied' ? <Notice tone="error" text={t('gymCheckin.cameraAsk')} /> : null}
          <Button title={result?.ok ? t('gymCheckin.scanAgain') : t('gymCheckin.scan')} busy={busy} onPress={() => void start()} />
          {perm && !perm.granted && perm.status === 'denied' ? <Button title={t('gymCheckin.showQrInstead')} variant="outline" onPress={onShowQr} /> : null}
        </>
      )}
    </View>
  );
}

function CheckinResult({ c }: { c: EntranceCheckin }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const warn = c.decision === 'warn' && c.reasons.length > 0;
  return (
    <Card style={{ borderColor: warn ? theme.prize : theme.brand, borderWidth: 2 }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Icon name={warn ? 'alert' : 'check'} size={26} color={warn ? theme.text : theme.brandText} />
        <ThemedText type="smallBold" style={{ flex: 1, fontSize: 16 }}>
          {c.counted ? t('gymCheckin.in', { gym: c.gym?.name ?? '' }) : t('gymCheckin.already', { time: c.firstCheckInToday ? timeOnly(c.firstCheckInToday, lang) : '' })}
        </ThemedText>
      </View>
      <ThemedText type="small">{t('gymCheckin.at', { time: timeOnly(c.checkedInAt, lang), code: c.member.memberCode })}</ThemedText>
      {c.membership ? (
        <ThemedText type="small" themeColor="textSecondary">
          {c.membership.title} · {c.membership.daysLeft > 0 ? t('gym.daysLeft', { n: count(c.membership.daysLeft, lang) }) : t('gym.lastDay')}
        </ThemedText>
      ) : null}
      {warn ? <ThemedText type="small">{t('gymCheckin.warn', { reasons: c.reasons.map((r) => t(`gymCheckin.reason.${r}`)).join(', ') })}</ThemedText> : null}
    </Card>
  );
}

/** The gym's refusal in plain words: blocked by the entry rule (with the reasons), an old code, or not a member. */
function ScanError({ error, message }: { error: unknown; message?: string }) {
  const { t } = useTranslation();
  if (message) return <Notice tone="error" text={message} />;
  if (error instanceof ApiError && error.code === 'GYM_ENTRY_BLOCKED') {
    const meta = (error.problem.meta ?? {}) as { reasons?: string[]; gym?: { name?: string } };
    const known = ['expired', 'frozen', 'none', 'unpaid', 'visit_limit'];
    const reasons = (meta.reasons ?? []).filter((r) => known.includes(r)).map((r) => t(`gymCheckin.reason.${r as 'expired'}`));
    return <Notice tone="error" text={[t('errors.GYM_ENTRY_BLOCKED'), reasons.length ? t('gymCheckin.because', { reasons: reasons.join(', ') }) : null].filter(Boolean).join(' ')} />;
  }
  return <ErrorNotice error={error} />;
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12, paddingBottom: 40 },
  qrBox: { backgroundColor: '#FFFFFF', alignItems: 'center', paddingVertical: 20, paddingHorizontal: 16, gap: 10 },
  qrGym: { color: '#111210', fontSize: 18, lineHeight: 26, fontWeight: '800', textAlign: 'center' },
  qrCode: { color: '#111210', fontSize: 16, lineHeight: 22, fontWeight: '700', letterSpacing: 1 },
  qrHint: { color: '#3A403C', fontSize: 13, lineHeight: 18 },
  camera: { width: '100%', aspectRatio: 1, borderWidth: 3, overflow: 'hidden', backgroundColor: '#000000' },
});
