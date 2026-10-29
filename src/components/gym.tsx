import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import type { ComponentProps, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Button, EmptyState, Notice } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { config } from '@/lib/config';
import { errorText } from '@/lib/errors';
import { ApiError } from '@/lib/esports-api';
import { findItem, safeVideo, splitDuration, textOf, type Bilingual, type Content } from '@/lib/gym';
import type { Lang } from '@/lib/format';

/** Building blocks of the member gym screens (M24 §4.5): the app's tokens, square corners, 48px targets. */

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Open a gym.kriraghor.com (or kriraghor.com) page in the in-app browser. */
export const openWeb = (url: string) => void WebBrowser.openBrowserAsync(url);
export const gymWeb = (path: string) => `${config.gymUrl}${path}`;

/** A yes or no question before an action that cannot be undone (Alert on phones, confirm() on the web build). */
export function confirmAction(title: string, body: string, yes: string, no: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${body}`)) onYes();
    return;
  }
  Alert.alert(title, body, [
    { text: no, style: 'cancel' },
    { text: yes, style: 'destructive', onPress: onYes },
  ]);
}

export function Card({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.line }, muted && { opacity: 0.6 }, style]}>{children}</View>;
}

/** A count on a row or a button (requests waiting). */
export function CountBadge({ n }: { n: number }) {
  const theme = useTheme();
  if (!n) return null;
  return (
    <View style={[styles.badge, { backgroundColor: theme.brand }]} accessibilityLabel={String(n)}>
      <ThemedText type="smallBold" style={{ color: theme.onBrand, fontSize: 12, lineHeight: 16 }}>
        {n > 99 ? '99+' : n}
      </ThemedText>
    </View>
  );
}

/** A full-width row that opens another screen or page (48px target, icon, label, optional badge). */
export function RowLink({ icon, label, hint, onPress, badge = 0, external }: { icon: IconName; label: string; hint?: string; onPress: () => void; badge?: number; external?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole={external ? 'link' : 'button'} onPress={onPress} style={({ pressed }) => [styles.row, { borderColor: theme.line, backgroundColor: theme.backgroundElement }, pressed && { opacity: 0.85 }]}>
      <MaterialCommunityIcons name={icon} size={22} color={theme.text} />
      <View style={{ flex: 1 }}>
        <ThemedText type="smallBold">{label}</ThemedText>
        {hint ? (
          <ThemedText type="small" themeColor="textSecondary">
            {hint}
          </ThemedText>
        ) : null}
      </View>
      <CountBadge n={badge} />
      <MaterialCommunityIcons name={external ? 'open-in-new' : 'chevron-right'} size={20} color={theme.textSecondary} />
    </Pressable>
  );
}

/** Loading while the first answer comes; signed out → sign in. Returns null once there is something to show. */
export function GymGate({ loading }: { loading: boolean }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { status } = useAuth();
  if (status === 'signed_out') return <EmptyState text={t('gym.signedOut')} action={{ title: t('common.signIn'), onPress: () => router.push('/sign-in') }} />;
  if (loading) return <ActivityIndicator color={theme.brand} style={{ flex: 1, backgroundColor: theme.background }} accessibilityLabel={t('common.loading')} />;
  return null;
}

/**
 * A failed call: our own text for the code, the offline line when there is no connection, and a way
 * on. PHONE_REQUIRED (gate join_gym) sends the member to verify the phone on kriraghor.com: the app has
 * no verify screen of its own. Gym members never need NID.
 */
export function ErrorNotice({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  if (!error) return null;
  if (error instanceof ApiError && error.code === 'PHONE_REQUIRED') {
    return (
      <View style={{ gap: 8 }}>
        <Notice tone="error" text={t('gym.phoneRequired')} />
        <Button title={t('gym.verifyPhone')} variant="outline" onPress={() => openWeb(`${config.webUrl}/me`)} />
      </View>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      <Notice tone="error" text={errorText(t, error)} />
      {onRetry ? <Button title={t('common.retry')} variant="outline" onPress={onRetry} /> : null}
    </View>
  );
}

/** "Given by {gym}, not medical advice" (M24-FR-69), on every plan view, in the reader's language. */
export function Safety({ text }: { text: Bilingual }) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  return (
    <View style={styles.safety}>
      <MaterialCommunityIcons name="alert-circle-outline" size={16} color={theme.textSecondary} style={{ marginTop: 2 }} />
      <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
        {textOf(text, i18n.language as Lang)}
      </ThemedText>
    </View>
  );
}

/** One exercise or food: its name in my language, the numbers the gym gave, the note, and the video link. */
export function ItemFacts({ content, itemRef }: { content: Content; itemRef: string }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const x = findItem(content, itemRef);
  if (!x) return null;
  const dur = (sec: number) => {
    const { m, s } = splitDuration(sec);
    return !m ? t('gymPlan.secs', { n: s }) : s ? t('gymPlan.minSecs', { m, s }) : t('gymPlan.mins', { n: m });
  };
  let facts: (string | null | undefined)[];
  let video: string | null = null;
  if ('portion' in x || content.kind === 'diet') {
    const f = x as { portion?: string | null; kcal?: number | null; proteinG?: number | null };
    facts = [f.portion, f.kcal != null ? t('gymPlan.kcal', { n: f.kcal }) : null, f.proteinG != null ? t('gymPlan.protein', { n: f.proteinG }) : null];
  } else {
    const w = x as { sets?: number | null; reps?: string | null; timeSec?: number | null; restSec?: number | null; weightNote?: string | null; videoUrl?: string | null };
    facts = [
      w.sets ? (w.reps ? t('gymPlan.setsReps', { sets: w.sets, reps: w.reps }) : t('gymPlan.sets', { n: w.sets })) : w.reps ? t('gymPlan.reps', { reps: w.reps }) : null,
      w.timeSec ? dur(w.timeSec) : null,
      w.restSec ? t('gymPlan.rest', { time: dur(w.restSec) }) : null,
      w.weightNote,
    ];
    video = safeVideo(w.videoUrl);
  }
  const line = facts.filter(Boolean).join(' · ');
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <ThemedText type="smallBold">{textOf(x.name, lang)}</ThemedText>
      {line ? (
        <ThemedText type="small" themeColor="textSecondary">
          {line}
        </ThemedText>
      ) : null}
      {x.note ? (
        <ThemedText type="small" themeColor="textSecondary">
          {x.note}
        </ThemedText>
      ) : null}
      {video ? (
        <Pressable accessibilityRole="link" onPress={() => openWeb(video)} style={styles.video} hitSlop={4}>
          <MaterialCommunityIcons name="play-circle-outline" size={18} color={theme.brandText} />
          <ThemedText type="smallBold" style={{ color: theme.brandText }}>
            {t('gymPlan.video')}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1.5, padding: 16, gap: 8 },
  badge: { minWidth: 22, height: 22, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  row: { minHeight: 52, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  safety: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  video: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, alignSelf: 'flex-start' },
});
