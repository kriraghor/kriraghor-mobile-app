import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Pill, SectionTitle, Segments } from '@/components/esports';
import { ThemedText } from '@/components/themed-text';
import { Button, Field, Notice } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { errorText } from '@/lib/errors';
import { named, type Squad } from '@/lib/esports';
import { acceptInvite, createSquad, declineInvite, inviteToSquad, joinSquad, leaveSquad, listGames, makeCaptain, myProfiles, mySquads, removeMember } from '@/lib/esports-api';
import { count, type Lang } from '@/lib/format';
import { useMe } from '@/lib/use-me';
import { keys } from '@/lib/use-realtime';

type SquadItem = Squad & { inviteCode: string | null; maxMembers: number; myMemberId: string };

/**
 * Squads (M21-FR-05): one per game. Invitations first (accept or decline), then my squads with
 * their invite code, members and what the captain can do; create one or join with a code below.
 */
export default function SquadsScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const qc = useQueryClient();
  const me = useMe();
  const squads = useQuery({ queryKey: ['squads'], queryFn: async () => (await mySquads()) as SquadItem[] });
  const games = useQuery({ queryKey: ['games'], queryFn: listGames, staleTime: 3600_000 });
  const profiles = useQuery({ queryKey: keys.profiles, queryFn: myProfiles });
  const [note, setNote] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(id: string, fn: () => Promise<unknown>, done?: string) {
    setBusy(id);
    setNote(null);
    try {
      await fn();
      if (done) setNote({ tone: 'info', text: done });
    } catch (err) {
      setNote({ tone: 'error', text: errorText(t, err) });
    } finally {
      setBusy(null);
      void qc.invalidateQueries({ queryKey: ['squads'] });
    }
  }

  if (squads.isLoading || games.isLoading) return <ActivityIndicator color={theme.brand} style={{ flex: 1, backgroundColor: theme.background }} />;
  const all = squads.data ?? [];
  const invites = all.filter((s) => s.myStatus === 'invited');
  const mine = all.filter((s) => s.myStatus === 'active');
  const verifiedGames = (games.data ?? []).filter((g) => profiles.data?.some((p) => p.gameId === g.id && p.status === 'verified'));
  const freeGames = verifiedGames.filter((g) => !mine.some((s) => s.gameId === g.id));
  const gameName = (id: string) => named(games.data?.find((g) => g.id === id), lang);

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      {note ? <Notice tone={note.tone} text={note.text} /> : null}

      {invites.map((s) => {
        const captain = s.members.find((m) => m.role === 'captain');
        return (
          <View key={s.id} style={[styles.card, { borderColor: theme.brand, backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">
              {s.name} [{s.tag}] · {gameName(s.gameId)}
            </ThemedText>
            <ThemedText type="small">{t('squads.invitation', { name: captain?.displayName ?? s.name })}</ThemedText>
            <View style={styles.buttons}>
              <View style={{ flex: 1 }}>
                <Button title={t('squads.accept')} busy={busy === `a${s.id}`} onPress={() => void run(`a${s.id}`, () => acceptInvite(s.myMemberId))} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title={t('squads.decline')} variant="outline" busy={busy === `d${s.id}`} onPress={() => void run(`d${s.id}`, () => declineInvite(s.myMemberId))} />
              </View>
            </View>
          </View>
        );
      })}

      {!mine.length && !invites.length ? <ThemedText themeColor="textSecondary">{t('squads.empty')}</ThemedText> : null}
      {mine.map((s) => (
        <SquadCard key={s.id} squad={s} myId={me.data?.id} gameName={gameName(s.gameId)} busy={busy} run={run} />
      ))}

      {/* Create: games with a verified game ID and no squad yet; say why when there is none at all. */}
      {freeGames.length ? (
        <>
          <SectionTitle>
            {t('squads.create')}
            {freeGames.length === 1 ? ` · ${named(freeGames[0], lang)}` : ''}
          </SectionTitle>
          <CreateForm games={freeGames} busy={busy === 'create'} onCreate={(body) => void run('create', () => createSquad(body))} />
        </>
      ) : !verifiedGames.length ? (
        <>
          <SectionTitle>{t('squads.create')}</SectionTitle>
          <ThemedText type="small" themeColor="textSecondary">
            {t('squads.needUid')}
          </ThemedText>
        </>
      ) : null}

      <SectionTitle>{t('squads.join')}</SectionTitle>
      <JoinForm busy={busy === 'join'} onJoin={(code) => void run('join', () => joinSquad(code))} />
    </ScrollView>
  );
}

function SquadCard({ squad, myId, gameName, busy, run }: { squad: SquadItem; myId?: string; gameName: string; busy: string | null; run: (id: string, fn: () => Promise<unknown>, done?: string) => Promise<void> }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const [username, setUsername] = useState('');
  const isCaptain = squad.captainUserId === myId;
  const active = squad.members.filter((m) => m.status === 'active');

  const leave = () => {
    const go = () => void run(`l${squad.id}`, () => leaveSquad(squad.id));
    if (Platform.OS === 'web') return go(); // Alert has no buttons on the web preview
    Alert.alert(t('squads.leave'), t('squads.leaveConfirm', { name: squad.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('squads.leave'), style: 'destructive', onPress: go },
    ]);
  };

  return (
    <View style={[styles.card, { borderColor: theme.line, backgroundColor: theme.backgroundElement }]}>
      <View style={styles.row}>
        <ThemedText style={styles.name}>
          {squad.name} [{squad.tag}]
        </ThemedText>
        <Pill text={gameName} tone="brand" />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {t('squads.full', { n: count(active.length, lang), max: count(squad.maxMembers, lang) })}
      </ThemedText>
      {squad.inviteCode ? (
        <View style={styles.row}>
          <ThemedText type="smallBold" style={{ flex: 1 }} selectable>
            {t('squads.inviteCode', { code: squad.inviteCode })}
          </ThemedText>
          <Button title={t('squads.copyCode')} variant="outline" onPress={() => void Clipboard.setStringAsync(squad.inviteCode!)} />
        </View>
      ) : null}

      {squad.members.map((m) => (
        <View key={m.id} style={[styles.member, { borderTopColor: theme.line }]}>
          <View style={{ flex: 1 }}>
            <ThemedText type="smallBold">
              {m.displayName}
              {m.userId === myId ? ` · ${t('ranks.you')}` : ''}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {m.role === 'captain' ? `${t('squads.captain')} · ` : ''}
              {m.status === 'invited' ? t('squads.invited') : (m.ign ?? t('squads.noUid'))}
            </ThemedText>
          </View>
          {isCaptain && m.userId !== myId ? (
            <View style={styles.memberActions}>
              {m.status === 'active' ? <Button title={t('squads.makeCaptain')} variant="outline" busy={busy === `c${m.id}`} onPress={() => void run(`c${m.id}`, () => makeCaptain(squad.id, m.userId))} /> : null}
              <Button title={t('squads.remove')} variant="outline" busy={busy === `r${m.id}`} onPress={() => void run(`r${m.id}`, () => removeMember(squad.id, m.userId))} />
            </View>
          ) : null}
        </View>
      ))}

      {isCaptain ? (
        <View style={{ gap: 8 }}>
          <Field label={t('squads.username')} value={username} onChangeText={setUsername} autoCapitalize="none" maxLength={30} />
          <Button
            title={t('squads.inviteButton')}
            busy={busy === `i${squad.id}`}
            onPress={() => username.trim().length >= 2 && void run(`i${squad.id}`, () => inviteToSquad(squad.id, username.trim().replace(/^@/, '')).then(() => setUsername('')))}
          />
        </View>
      ) : null}
      <Button title={t('squads.leave')} variant="outline" busy={busy === `l${squad.id}`} onPress={leave} />
    </View>
  );
}

function CreateForm({ games, busy, onCreate }: { games: { id: string; key: string; nameEn: string; nameBn: string }[]; busy: boolean; onCreate: (b: { gameId: string; name: string; tag: string }) => void }) {
  const { t, i18n } = useTranslation();
  const [gameId, setGameId] = useState(games[0].id);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const valid = name.trim().length >= 2 && /^[A-Za-z0-9]{2,8}$/.test(tag);
  return (
    <View style={{ gap: 8 }}>
      {games.length > 1 ? (
        <View style={{ marginHorizontal: -16 }}>
          <Segments items={games.map((g) => ({ key: g.id, label: named(g, i18n.language) }))} value={gameId} onChange={setGameId} />
        </View>
      ) : null}
      <Field label={t('squads.name')} value={name} onChangeText={setName} maxLength={40} />
      <Field label={t('squads.tag')} value={tag} onChangeText={(v) => setTag(v.toUpperCase())} autoCapitalize="characters" maxLength={8} />
      <Button title={t('squads.createButton')} busy={busy} onPress={() => valid && onCreate({ gameId, name: name.trim(), tag })} />
    </View>
  );
}

function JoinForm({ busy, onJoin }: { busy: boolean; onJoin: (code: string) => void }) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  return (
    <View style={{ gap: 8 }}>
      <Field label={t('squads.code')} value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" maxLength={12} />
      <Button title={t('squads.joinButton')} variant="outline" busy={busy} onPress={() => code.trim().length >= 6 && onJoin(code.trim())} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12 },
  card: { borderWidth: 1.5, padding: 14, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 18, lineHeight: 26, fontWeight: '700' },
  member: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, paddingTop: 8 },
  memberActions: { gap: 6, minWidth: 120 },
  buttons: { flexDirection: 'row', gap: 8 },
});
