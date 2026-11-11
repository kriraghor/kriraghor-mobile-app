import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { AnimatedPressable } from '@/components/ui';
import { displayFace } from '@/constants/fonts';
import { Radius } from '@/constants/motion';
import { useTheme } from '@/hooks/use-theme';
import { named, title, type TournamentCard } from '@/lib/esports';
import { count, dateTime, money, type Lang } from '@/lib/format';

/** Esports building blocks (UI v2): cards 20, controls 12, chips full; green for actions, the logo's orange for prize money and live. */

export function Pill({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'brand' | 'prize' | 'danger' }) {
  const theme = useTheme();
  const color = tone === 'brand' ? theme.brandText : tone === 'prize' ? theme.prizeText : tone === 'danger' ? theme.danger : theme.textSecondary;
  const fill = tone === 'brand' ? theme.brandSoft : tone === 'prize' ? theme.accentSoft : tone === 'danger' ? theme.dangerSoft : theme.backgroundSelected;
  return (
    <View style={[styles.pill, { backgroundColor: fill }]}>
      <ThemedText type="smallBold" style={{ color, fontSize: 12, lineHeight: 18 }}>
        {text}
      </ThemedText>
    </View>
  );
}

/** One choice out of a few (event groups, games). Horizontally scrollable, 44px targets. */
export function Segments<K extends string>({ items, value, onChange }: { items: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segments} accessibilityRole="tablist">
      {items.map((it) => {
        const selected = it.key === value;
        return (
          <Pressable
            key={it.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(it.key)}
            style={[styles.segment, { borderColor: selected ? theme.brand : theme.line, backgroundColor: selected ? theme.brand : theme.backgroundElement }]}>
            <ThemedText type="smallBold" style={{ color: selected ? theme.onBrand : theme.text }}>
              {it.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.section}>
      {children}
    </ThemedText>
  );
}

/** A row of label and value, for detail pages. */
export function InfoRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <ThemedText type="small" themeColor="textSecondary" style={{ flexShrink: 0, maxWidth: '45%' }}>
        {label}
      </ThemedText>
      <ThemedText type={strong ? 'smallBold' : 'small'} style={{ flex: 1, textAlign: 'right' }}>
        {value}
      </ThemedText>
    </View>
  );
}

/** The slots bar: filled share of max slots (M21-FR-09). */
export function SlotsBar({ taken, max }: { taken: number; max: number }) {
  const theme = useTheme();
  const share = max > 0 ? Math.min(1, taken / max) : 0;
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max, now: taken }} style={[styles.bar, { backgroundColor: theme.backgroundSelected }]}>
      <View style={{ width: `${share * 100}%`, height: '100%', backgroundColor: share >= 1 ? theme.danger : theme.brand }} />
    </View>
  );
}

export function EventCard({ event }: { event: TournamentCard }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const free = event.entryFee.amount === 0;
  const full = event.slotsTaken >= event.maxSlots;
  return (
    <AnimatedPressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/events/[id]', params: { id: event.id } })}
      style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.line }]}>
      <View style={styles.cardTop}>
        <Pill text={named(event.game, lang)} tone="brand" />
        <Pill text={event.entryUnit === 'squad' ? t('events.squadOf', { size: event.mode.teamSize }) : t('events.solo')} />
        {full ? <Pill text={t('events.full')} tone="danger" /> : null}
      </View>
      <ThemedText style={styles.cardTitle}>{title(event, lang)}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t('events.starts')} {dateTime(event.startsAt, lang)}
      </ThemedText>
      <View style={styles.money}>
        <View style={{ flex: 1 }}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('events.prizePool')}
          </ThemedText>
          <ThemedText style={[styles.prize, { color: theme.prizeText }]}>{money(event.prizePool.amount, lang)}</ThemedText>
          {event.killReward && event.killReward.amount > 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('events.perKill', { amount: money(event.killReward.amount, lang) })}
            </ThemedText>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('events.entry')}
          </ThemedText>
          <ThemedText style={styles.fee}>{free ? t('events.free') : money(event.entryFee.amount, lang)}</ThemedText>
        </View>
      </View>
      <SlotsBar taken={event.slotsTaken} max={event.maxSlots} />
      <ThemedText type="small" themeColor="textSecondary">
        {t('events.slots', { taken: count(event.slotsTaken, lang), max: count(event.maxSlots, lang) })}
        {event.waitlist > 0 ? ` · ${t('events.waitlist', { count: event.waitlist })}` : ''}
      </ThemedText>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  segments: { gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  segment: { minHeight: 48, paddingHorizontal: 16, borderWidth: 2, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  section: { textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8 },
  infoRow: { flexDirection: 'row', gap: 12, paddingVertical: 6 },
  bar: { height: 6, width: '100%', overflow: 'hidden', borderRadius: 3 },
  card: { borderWidth: 1, borderRadius: Radius.card, padding: 16, gap: 8, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  cardTitle: { ...displayFace, fontSize: 20, lineHeight: 26 },
  money: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 4 },
  prize: { ...displayFace, fontSize: 26, lineHeight: 32 },
  fee: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
});
