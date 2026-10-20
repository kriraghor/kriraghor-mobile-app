import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { named, title, type TournamentCard } from '@/lib/esports';
import { count, dateTime, money, type Lang } from '@/lib/format';

/** Esports building blocks: square corners (shape lock), green for actions, amber only for prize money. */

export function Pill({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'brand' | 'prize' | 'danger' }) {
  const theme = useTheme();
  const color = tone === 'brand' ? theme.brandText : tone === 'prize' ? theme.text : tone === 'danger' ? theme.danger : theme.textSecondary;
  const border = tone === 'brand' ? theme.brand : tone === 'prize' ? theme.prize : tone === 'danger' ? theme.danger : theme.line;
  return (
    <View style={[styles.pill, { borderColor: border }]}>
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
      <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
        {label}
      </ThemedText>
      <ThemedText type={strong ? 'smallBold' : 'small'}>{value}</ThemedText>
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
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/events/[id]', params: { id: event.id } })}
      style={({ pressed }) => [styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.line }, pressed && { opacity: 0.85 }]}>
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
          <ThemedText style={[styles.prize, { color: theme.text }]}>{money(event.prizePool.amount, lang)}</ThemedText>
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
      {/* Amber marks prize money only (docs 09): a thin bar on the card's edge, not the whole card. */}
      <View style={[styles.prizeRule, { backgroundColor: theme.prize }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { borderWidth: 1.5, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  segments: { gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  segment: { minHeight: 44, paddingHorizontal: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  section: { textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8 },
  infoRow: { flexDirection: 'row', gap: 12, paddingVertical: 6 },
  bar: { height: 6, width: '100%', overflow: 'hidden' },
  card: { borderWidth: 1.5, padding: 16, gap: 8, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  cardTitle: { fontSize: 18, lineHeight: 26, fontWeight: '700' },
  money: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 4 },
  prize: { fontSize: 22, lineHeight: 30, fontWeight: '800' },
  fee: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  prizeRule: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
});
