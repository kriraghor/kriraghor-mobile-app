import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { InfoRow, Pill, Segments } from '@/components/esports';
import { Card, ErrorNotice, GymGate, gymWeb, openWeb } from '@/components/gym';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { useTabBarInset } from '@/hooks/use-tab-bar-inset';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { dateOnly } from '@/lib/gym';
import { myPass, myPasses, type Pass } from '@/lib/gym-api';
import { money, type Lang } from '@/lib/format';
import { keys } from '@/lib/use-realtime';

type Group = 'active' | 'used' | 'expired';
const GROUPS: Group[] = ['active', 'used', 'expired'];

/**
 * My gym passes (M20, gym.kriraghor.com /me/passes): active, used and expired. Opening a pass shows
 * its QR and backup code for the front desk, only while the pass is active (the API sends them only
 * then). A pass waiting for payment is paid in the app; cancelling stays on gym.kriraghor.com.
 */
export default function GymPasses() {
  const theme = useTheme();
  const tabInset = useTabBarInset();
  const { t } = useTranslation();
  const { status } = useAuth();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ code?: string }>();
  const [group, setGroup] = useState<Group>('active');
  const [open, setOpen] = useState<string | null>(params.code ?? null);
  // A tab stays mounted: a later link to another pass (?code=) opens that one.
  const [seenCode, setSeenCode] = useState(params.code);
  if (seenCode !== params.code) {
    setSeenCode(params.code);
    if (params.code) setOpen(params.code);
  }
  const list = useQuery({ queryKey: keys.gymPasses(group), queryFn: async () => (await myPasses(group)).items, enabled: status === 'signed_in' });

  if (status !== 'signed_in') return <GymGate loading={false} />;
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Segments items={GROUPS.map((g) => ({ key: g, label: t(`gymPasses.group.${g}`) }))} value={group} onChange={setGroup} />
      <ScrollView
        contentContainerStyle={[styles.page, { paddingBottom: 24 + tabInset }]}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void qc.invalidateQueries({ queryKey: ['gym', 'pass'] }).then(() => list.refetch())} tintColor={theme.brand} />}>
        {list.isLoading ? <GymGate loading /> : null}
        <ErrorNotice error={list.error} onRetry={() => void list.refetch()} />
        {list.data && !list.data.length ? (
          <Card>
            <ThemedText type="small" themeColor="textSecondary">
              {t(`gymPasses.none.${group}`)}
            </ThemedText>
            <Button title={t('gym.findGym')} variant="outline" onPress={() => openWeb(gymWeb('/gyms'))} />
          </Card>
        ) : null}
        {(list.data ?? []).map((p) => (
          <PassCard key={p.id} p={p} open={open === p.code} onToggle={() => setOpen(open === p.code ? null : p.code)} />
        ))}
      </ScrollView>
    </View>
  );
}

function PassCard({ p, open, onToggle }: { p: Pass; open: boolean; onToggle: () => void }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const { width } = useWindowDimensions();
  const [boxWidth, setBoxWidth] = useState(0);
  const detail = useQuery({ queryKey: keys.gymPass(p.code), queryFn: () => myPass(p.code), enabled: open, staleTime: 0 });
  const full = detail.data?.pass;
  const tone = p.status === 'active' ? 'brand' : p.status === 'pending_payment' ? 'prize' : p.status === 'cancelled' || p.status === 'refunded' || p.status === 'void' ? 'danger' : 'neutral';
  const dates = p.validFrom === p.validTo ? dateOnly(p.validFrom, lang) : `${dateOnly(p.validFrom, lang)} – ${dateOnly(p.validTo, lang)}`;
  return (
    <Card>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onToggle} style={styles.top}>
        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold" style={{ fontSize: 16 }}>
            {p.gym?.name ?? '–'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {p.title} · {p.code}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {dates}
          </ThemedText>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Pill text={t(`gymPasses.status.${p.status}`)} tone={tone} />
          <ThemedText type="smallBold">{money(p.money.price, lang)}</ThemedText>
        </View>
      </Pressable>
      {open ? (
        <View style={{ gap: 10 }}>
          {detail.isLoading ? <GymGate loading /> : null}
          <ErrorNotice error={detail.error} onRetry={() => void detail.refetch()} />
          {full?.status === 'active' && full.token ? (
            <View style={styles.qrBox} onLayout={(e) => setBoxWidth(e.nativeEvent.layout.width)} accessible accessibilityLabel={t('gymPasses.qrAlt', { code: full.code })}>
              <QRCode value={full.token} size={Math.max(120, Math.min((boxWidth || width - 64) - 48, 280))} ecl="M" color="#111210" backgroundColor="#FFFFFF" quietZone={8} />
              {full.backupCode ? (
                <ThemedText style={styles.backup}>
                  {t('gymPasses.backup')}: {full.backupCode}
                </ThemedText>
              ) : null}
            </View>
          ) : full ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('gymPasses.noQr')}
            </ThemedText>
          ) : null}
          {full?.gym?.addressLine ? <InfoRow label={t('gymPasses.address')} value={full.gym.addressLine} /> : null}
          {full?.status === 'pending_payment' && detail.data?.payment ? (
            <Button title={t('gym.payAmount', { amount: money(full.money.price, lang) })} onPress={() => router.push({ pathname: '/pay/[paymentId]', params: { paymentId: detail.data!.payment!.id } })} />
          ) : null}
          {full?.can.cancel ? <Button title={t('gymPasses.manage')} variant="outline" onPress={() => openWeb(gymWeb(`/me/passes/${encodeURIComponent(p.code)}`))} /> : null}
          {full?.closeReason ? (
            <ThemedText type="small" themeColor="textSecondary" style={{ color: theme.textSecondary }}>
              {full.closeReason}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12, paddingBottom: 40 },
  top: { flexDirection: 'row', gap: 10, minHeight: 48 },
  qrBox: { backgroundColor: '#FFFFFF', alignItems: 'center', padding: 16, gap: 10 },
  backup: { color: '#111210', fontSize: 16, lineHeight: 22, fontWeight: '700', letterSpacing: 1 },
});
