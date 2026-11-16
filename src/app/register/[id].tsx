import { Icon } from '@/components/icons/Icon';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { InfoRow, Pill, SectionTitle } from '@/components/esports';
import { ThemedText } from '@/components/themed-text';
import { Button, Notice, ScreenLoading } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { ApiError, getEvent, idempotencyKey, myProfiles, mySquads, register } from '@/lib/esports-api';
import { errorText } from '@/lib/errors';
import { named, title, type Squad } from '@/lib/esports';
import { dateTime, money, type Lang } from '@/lib/format';
import { keys } from '@/lib/use-realtime';
import { SignedInOnly } from '@/components/guest';
import { inEsports } from '@/hooks/theme-scope';
import { Radius } from '@/constants/motion';
import { displayFace } from '@/constants/fonts';

/**
 * Register for an event (M21-FR-08 to FR-10). Solo: the player's verified game ID. Squad: the
 * captain picks exactly the mode's team size from members with a verified game ID, plus optional
 * substitutes. The server holds a slot (pay next), confirms a free entry, or puts the entry on the
 * waitlist. One Idempotency-Key per attempt; a retry after a network error reuses it.
 */
function RegisterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const qc = useQueryClient();
  const event = useQuery({ queryKey: keys.event(id), queryFn: () => getEvent(id) });
  const profiles = useQuery({ queryKey: keys.profiles, queryFn: myProfiles });
  const squad = event.data?.entryUnit === 'squad';
  const squads = useQuery({ queryKey: ['squads'], queryFn: mySquads, enabled: squad });
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data, error } = await api.GET('/me');
      if (error) throw error;
      return data as { id: string };
    },
  });
  const [players, setPlayers] = useState<string[]>([]);
  const [subs, setSubs] = useState<string[]>([]);
  const [squadId, setSquadId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const key = useRef(idempotencyKey('reg'));

  if (!event.data || profiles.isLoading || (squad && squads.isLoading)) return <ScreenLoading />;
  const e = event.data;
  const gameName = named(e.game, lang);
  const profile = profiles.data?.find((p) => p.gameId === e.game.id && p.status !== 'unlinked' && p.status !== 'rejected') ?? null;
  const teamSize = e.mode.teamSize;

  async function submit(body: { squadId?: string; players: string[]; substitutes?: string[] }) {
    setBusy(true);
    setError(null);
    try {
      const r = await register(e.id, body, key.current);
      void qc.invalidateQueries({ queryKey: keys.registrations });
      void qc.invalidateQueries({ queryKey: keys.event(id) });
      if (r.registration.status === 'pending_payment' && r.registration.paymentId) {
        router.replace({ pathname: '/pay/[paymentId]', params: { paymentId: r.registration.paymentId } });
      } else {
        setDone(r.waitlisted ? t('register.waitlisted') : t('register.confirmed'));
      }
    } catch (err) {
      // A definite answer from the server ends this attempt; a lost connection may be retried as is.
      if (err instanceof ApiError) key.current = idempotencyKey('reg');
      setError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <>
      <View style={[styles.summary, { backgroundColor: theme.backgroundElement, borderColor: theme.line }]}>
        <View style={styles.pills}>
          <Pill text={gameName} tone="brand" />
          <Pill text={e.entryUnit === 'squad' ? t('events.squadOf', { size: e.mode.teamSize }) : t('events.solo')} />
        </View>
        <ThemedText style={styles.title} accessibilityRole="header">
          {title(e, lang)}
        </ThemedText>
        <InfoRow label={t('register.fee')} value={e.entryFee.amount ? money(e.entryFee.amount, lang) : t('events.free')} strong />
        <InfoRow label={t('events.starts')} value={dateTime(e.startsAt, lang)} />
      </View>
      {error ? <Notice tone="error" text={error} /> : null}
    </>
  );

  if (done) {
    return (
      <View style={[styles.page, { flex: 1, backgroundColor: theme.background }]}>
        {header}
        <Notice text={done} />
        <Button title={t('event.seeMyMatch')} onPress={() => router.navigate('/matches')} />
      </View>
    );
  }

  // Solo needs this player's verified game ID; a squad needs it for every listed player (checked below).
  if (!squad && profile?.status !== 'verified') {
    return (
      <View style={[styles.page, { flex: 1, backgroundColor: theme.background }]}>
        {header}
        <Notice text={profile?.status === 'pending' ? t('register.gameIdPending', { game: gameName }) : t('register.needGameId', { game: gameName })} />
        {profile?.status !== 'pending' ? <Button title={t('register.addGameId')} onPress={() => router.push({ pathname: '/game-ids', params: { game: e.game.key } })} /> : null}
      </View>
    );
  }

  if (!squad && profile) {
    return (
      <View style={[styles.page, { flex: 1, backgroundColor: theme.background }]}>
        {header}
        <View style={[styles.playing, { backgroundColor: theme.brandSoft }]}>
          <Icon name="id-card" size={22} color={theme.brandText} />
          <ThemedText type="smallBold" style={{ flex: 1 }}>
            {t('register.playingAs', { ign: profile.ign, uid: profile.uidMasked })}
          </ThemedText>
        </View>
        <Button title={t('register.confirm')} variant="accent" icon="check" busy={busy} onPress={() => void submit({ players: [profile.id] })} />
      </View>
    );
  }

  const mine: Squad[] = (squads.data ?? []).filter((s) => s.gameId === e.game.id && s.myStatus === 'active');
  const chosen = mine.find((s) => s.id === squadId) ?? (mine.length === 1 ? mine[0] : null);
  if (!mine.length) {
    return (
      <View style={[styles.page, { flex: 1, backgroundColor: theme.background }]}>
        {header}
        <Notice text={t('register.noSquad', { game: gameName })} />
        <Button title={t('squads.title')} onPress={() => router.push('/squads')} />
      </View>
    );
  }
  const isCaptain = chosen && me.data ? chosen.captainUserId === me.data.id : false;
  const members = (chosen?.members ?? []).filter((m) => m.status === 'active');
  const toggle = (list: string[], set: (v: string[]) => void, pid: string, max: number) => set(list.includes(pid) ? list.filter((x) => x !== pid) : list.length < max ? [...list, pid] : list);

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.page}>
      {header}
      {mine.length > 1 ? (
        <>
          <SectionTitle>{t('register.squad')}</SectionTitle>
          {mine.map((s) => (
            <Choice key={s.id} label={`${s.name} [${s.tag}]`} selected={chosen?.id === s.id} onPress={() => (setSquadId(s.id), setPlayers([]), setSubs([]))} />
          ))}
        </>
      ) : chosen ? (
        <ThemedText type="smallBold">
          {chosen.name} [{chosen.tag}]
        </ThemedText>
      ) : null}
      {chosen && !isCaptain ? <Notice text={t('register.onlyCaptain')} /> : null}
      {chosen && isCaptain ? (
        <>
          <SectionTitle>{t('register.pickPlayers', { count: teamSize })}</SectionTitle>
          {members.map((m) => (
            <Choice
              key={m.id}
              label={m.ign ? `${m.displayName} · ${m.ign}` : `${m.displayName} · ${t('register.noUid')}`}
              disabled={!m.profileId || subs.includes(m.profileId)}
              selected={!!m.profileId && players.includes(m.profileId)}
              onPress={() => m.profileId && toggle(players, setPlayers, m.profileId, teamSize)}
            />
          ))}
          {e.mode.maxSubs > 0 ? (
            <>
              <SectionTitle>{t('register.substitutes', { count: e.mode.maxSubs })}</SectionTitle>
              {members
                .filter((m) => m.profileId && !players.includes(m.profileId))
                .map((m) => (
                  <Choice key={m.id} label={`${m.displayName} · ${m.ign ?? ''}`} selected={subs.includes(m.profileId!)} onPress={() => toggle(subs, setSubs, m.profileId!, e.mode.maxSubs)} />
                ))}
            </>
          ) : null}
          <Button
            title={t('register.confirm')}
            variant="accent"
            icon="check"
            busy={busy}
            onPress={() => (players.length === teamSize ? void submit({ squadId: chosen.id, players, substitutes: subs }) : setError(t('errors.ESPORTS_SQUAD_SIZE_INVALID')))}
          />
        </>
      ) : null}
    </ScrollView>
  );
}

function Choice({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.choice, { borderColor: selected ? theme.brand : theme.line, backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement, opacity: disabled ? 0.45 : 1 }]}>
      <Icon name={selected ? 'checkbox-on' : 'checkbox'} size={22} color={selected ? theme.brand : theme.textSecondary} />
      <ThemedText type="smallBold" style={{ flex: 1, color: selected ? theme.brandText : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12 },
  title: { ...displayFace, fontSize: 24, lineHeight: 30 },
  summary: { borderWidth: 1, borderRadius: Radius.card, padding: 16, gap: 6 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  playing: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: Radius.control, padding: 12 },
  choice: { minHeight: 48, borderWidth: 1.5, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: Radius.control },
});

/** The person's own page: a guest sees a friendly Sign in (the modal closes back here), never an error. */
function RegisterScreenRoute() {
  return (
    <SignedInOnly>
      <RegisterScreen />
    </SignedInOnly>
  );
}

// Dark like the Esports section it belongs to (UI v2).
export default inEsports(RegisterScreenRoute);
