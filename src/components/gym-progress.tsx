import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { InfoRow } from '@/components/esports';
import { Card, confirmAction, ErrorNotice } from '@/components/gym';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { count, money, type Lang } from '@/lib/format';
import { dateOnly, duePayState } from '@/lib/gym';
import { cancelRenewal, myBody, myRenewal, type Due } from '@/lib/gym-api';
import { BODY_UNIT, chartPoints, chartRange, renewState, type BodyField } from '@/lib/gym-progress';
import { keys } from '@/lib/use-realtime';

export const renewalKey = (memberId: string) => [...keys.gymMembership(memberId), 'renewal'] as const;
export const bodyKey = (memberId: string) => [...keys.gymMembership(memberId), 'body'] as const;

/** A number with one decimal in the reader's digits ("78.4", "৭৮.৪"). */
export function decimal(n: number, lang: Lang): string {
  const [whole, part] = n.toFixed(1).split('.');
  return part === '0' ? count(Number(whole), lang) : `${count(Number(whole), lang)}.${count(Number(part), lang)}`;
}

/**
 * Renew on my membership (M24 §19, mirrors the gym site's RenewCard): from the days before the end the
 * member opens the renew screen; a renewal that waits shows what is still to pay (Pay online when the gym
 * takes it) and, while unpaid, Cancel renewal; too early shows the first day; a gym that switched it off
 * says renewals are taken at the front desk.
 */
export function RenewCard({ memberId, dues, onPay, payBusy }: { memberId: string; dues: Due[]; onPay: (dueId: string) => void; payBusy: string | null }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const qc = useQueryClient();
  const q = useQuery({ queryKey: renewalKey(memberId), queryFn: () => myRenewal(memberId), retry: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  if (!q.data) return null;
  const r = q.data;
  const state = renewState(r);
  if (state.kind === 'none') return null;
  if (state.kind === 'later') {
    return state.on ? (
      <ThemedText type="small" themeColor="textSecondary">
        {t('gymRenew.later', { date: dateOnly(state.on, lang) })}
      </ThemedText>
    ) : null;
  }
  if (state.kind === 'desk') {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        {t('gymRenew.desk')}
      </ThemedText>
    );
  }
  if (state.kind === 'waiting' && r.renewal) {
    const w = r.renewal;
    const due = dues.find((d) => d.dueId === w.dueId);
    const online = due ? duePayState(due).kind === 'online' : false;
    const cancel = () =>
      confirmAction(t('gymRenew.cancelTitle'), t('gymRenew.cancelBody'), t('gymRenew.cancel'), t('gymRenew.keep'), async () => {
        setBusy(true);
        setError(null);
        try {
          qc.setQueryData(renewalKey(memberId), await cancelRenewal(memberId));
          void qc.invalidateQueries({ queryKey: keys.gym });
        } catch (err) {
          setError(err);
        } finally {
          setBusy(false);
        }
      });
    return (
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          {t('gymRenew.waitingTitle')}
        </ThemedText>
        <InfoRow label={w.title} value={w.outstandingPoisha > 0 ? money(w.outstandingPoisha, lang) : t('gymRenew.paidShort')} strong />
        <ThemedText type="small" themeColor="textSecondary">
          {dateOnly(w.startsOn, lang)} – {dateOnly(w.endsOn, lang)}
        </ThemedText>
        {w.outstandingPoisha > 0 ? (
          online && due ? (
            <Button title={t('gym.payAmount', { amount: money(w.outstandingPoisha, lang) })} busy={payBusy === due.dueId} disabled={payBusy !== null || busy} onPress={() => onPay(due.dueId)} />
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              {t('gymRenew.payAtDesk')}
            </ThemedText>
          )
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {t('gymRenew.paid')}
          </ThemedText>
        )}
        <ErrorNotice error={error} />
        {w.cancellable ? <Button title={t('gymRenew.cancel')} variant="outline" busy={busy} onPress={cancel} /> : null}
      </Card>
    );
  }
  return (
    <Card>
      <ThemedText type="smallBold">{r.current?.status === 'expired' ? t('gymRenew.expiredTitle') : t('gymRenew.title', { date: r.current ? dateOnly(r.current.endsOn, lang) : '' })}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t('gymRenew.lead')}
      </ThemedText>
      <Button title={t('gymRenew.open')} variant="accent" icon="arrow-right" onPress={() => router.push({ pathname: '/gym/renew', params: { m: memberId } })} />
    </Card>
  );
}

/**
 * My body progress on my membership (M24 §20): the latest weight and the change since the first entry,
 * and a way into the full screen. Hidden when the gym's plan does not include it.
 */
export function ProgressCard({ memberId }: { memberId: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const q = useQuery({ queryKey: bodyKey(memberId), queryFn: () => myBody(memberId), retry: false });
  if (!q.data?.on) return null;
  const change = q.data.change.weightKg;
  const latest = [...q.data.entries].reverse().find((e) => e.weightKg != null);
  return (
    <Card>
      <ThemedText type="smallBold">{t('gymProgress.title')}</ThemedText>
      {latest?.weightKg != null ? (
        <InfoRow label={t('gymProgress.latest', { date: dateOnly(latest.measuredOn, lang, { year: false }) })} value={t('gymProgress.unit.kg', { n: decimal(latest.weightKg, lang) })} strong />
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {t('gymProgress.empty')}
        </ThemedText>
      )}
      {change ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t(change.delta > 0 ? 'gymProgress.up' : change.delta < 0 ? 'gymProgress.down' : 'gymProgress.same', { amount: t('gymProgress.unit.kg', { n: decimal(Math.abs(change.delta), lang) }) })}{' '}
          {t('gymProgress.sinceShort', { date: dateOnly(change.fromOn, lang) })}
        </ThemedText>
      ) : null}
      <Button title={t('gymProgress.open')} variant="outline" onPress={() => router.push({ pathname: '/gym/[memberId]/body', params: { memberId } })} />
    </Card>
  );
}

const PAD = 28;

/**
 * One measurement over time as a single line (no legend: the heading names it). Points sit by date; the
 * vertical range hugs the values and both ends are printed, so a small change is visible and not read as
 * a drop to zero. Tapping a point shows its date and value (the latest by default); the entries list under
 * the chart is the table view.
 */
export function BodyChart({ field, series, width }: { field: BodyField; series: { date: string; value: number }[]; width: number }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const [picked, setPicked] = useState<number | null>(null);
  if (series.length < 2 || width < 120) return null;
  const h = 190;
  const pts = chartPoints(series, { w: width, h, pad: PAD });
  const range = chartRange(series.map((p) => p.value));
  const last = series.length - 1;
  const shown = picked !== null && picked <= last ? picked : last;
  const unit = (n: number) => t(`gymProgress.unit.${BODY_UNIT[field]}`, { n: decimal(n, lang) });
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={t('gymProgress.chartLabel', { field: t(`gymProgress.field.${field}`), from: unit(series[0].value), to: unit(series[last].value) })}>
      <ThemedText type="smallBold">
        {unit(series[shown].value)}{' '}
        <ThemedText type="small" themeColor="textSecondary">
          {dateOnly(series[shown].date, lang)}
        </ThemedText>
      </ThemedText>
      <View style={{ width, height: h }}>
        <Svg width={width} height={h}>
          <Line x1={PAD} x2={width - PAD} y1={PAD} y2={PAD} stroke={theme.line} strokeWidth={1} />
          <Line x1={PAD} x2={width - PAD} y1={h - PAD} y2={h - PAD} stroke={theme.line} strokeWidth={1} />
          <Path d={path} fill="none" stroke={theme.brand} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {pts.map((p, i) => (
            <Circle key={series[i].date} cx={p.x} cy={p.y} r={i === shown ? 6 : 4} fill={theme.brand} stroke={theme.backgroundElement} strokeWidth={2} />
          ))}
        </Svg>
        {pts.map((p, i) => (
          <Pressable
            key={series[i].date}
            accessibilityRole="button"
            accessibilityLabel={`${dateOnly(series[i].date, lang)}: ${unit(series[i].value)}`}
            onPress={() => setPicked(i)}
            style={{ position: 'absolute', left: p.x - 22, top: p.y - 22, width: 44, height: 44 }}
          />
        ))}
        <ThemedText type="small" themeColor="textSecondary" style={{ position: 'absolute', left: 0, top: 4, fontSize: 11, lineHeight: 14 }}>
          {unit(range.max)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={{ position: 'absolute', left: 0, bottom: 4, fontSize: 11, lineHeight: 14 }}>
          {unit(range.min)}
        </ThemedText>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <ThemedText type="small" themeColor="textSecondary">
          {dateOnly(series[0].date, lang, { year: false })}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {dateOnly(series[last].date, lang, { year: false })}
        </ThemedText>
      </View>
    </View>
  );
}
