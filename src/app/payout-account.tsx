import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { SectionTitle } from '@/components/esports';
import { ThemedText } from '@/components/themed-text';
import { Button, Field, Notice } from '@/components/ui';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { errorText } from '@/lib/errors';
import { addPayoutAccount, payoutAccounts, sendPayoutCode } from '@/lib/esports-api';
import { dateTime, type Lang } from '@/lib/format';
import { normaliseWallet } from '@/lib/player';

/**
 * The payout account (M07): one bKash or Nagad wallet in the player's own name. A code to the
 * verified phone confirms it is them; finance then checks the name against the NID before it is
 * used. Account numbers are never shown in full.
 */
export default function PayoutAccountScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const qc = useQueryClient();
  const now = useNow(60_000);
  const accounts = useQuery({ queryKey: ['payout-accounts'], queryFn: payoutAccounts });
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'bkash' | 'nagad'>('bkash');
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [declared, setDeclared] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);

  if (accounts.isLoading) return <ActivityIndicator color={theme.brand} style={{ flex: 1, backgroundColor: theme.background }} />;
  const list = accounts.data ?? [];
  const active = list.find((a) => a.status === 'active');
  const latest = list.find((a) => a.status === 'pending_verification' || a.status === 'rejected');
  const wallet = normaliseWallet(number);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setNote(null);
    try {
      await fn();
    } catch (err) {
      setNote({ tone: 'error', text: errorText(t, err) });
    } finally {
      setBusy(false);
    }
  }

  const send = () =>
    run(async () => {
      if (!wallet) return setNote({ tone: 'error', text: t('payout.numberInvalid') });
      if (name.trim().length < 3 || !declared) return;
      await sendPayoutCode();
      setCodeSent(true);
      setNote({ tone: 'info', text: t('payout.sent') });
    });

  const submit = () =>
    run(async () => {
      await addPayoutAccount({ type, accountNo: wallet!, accountName: name.trim(), code: code.trim() });
      setNote({ tone: 'info', text: t('payout.added') });
      setOpen(false);
      setCodeSent(false);
      setCode('');
      void qc.invalidateQueries({ queryKey: ['payout-accounts'] });
      void qc.invalidateQueries({ queryKey: ['withdrawable'] });
    });

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      {active ? <Notice text={t('payout.active', { account: active.masked })} /> : null}
      {active?.holdUntil && Date.parse(active.holdUntil) > now ? <Notice text={t('payout.hold', { at: dateTime(active.holdUntil, lang) })} /> : null}
      {latest?.status === 'pending_verification' ? <Notice text={t('payout.pending', { account: latest.masked })} /> : null}
      {latest?.status === 'rejected' ? <Notice tone="error" text={t('payout.rejected', { account: latest.masked, note: latest.reviewNote ?? '' })} /> : null}
      {note ? <Notice tone={note.tone} text={note.text} /> : null}

      {!open ? (
        <Button title={active || latest ? t('payout.replace') : t('payout.add')} variant={active ? 'outline' : 'primary'} onPress={() => setOpen(true)} />
      ) : (
        <View style={{ gap: 10 }}>
          <SectionTitle>{t('payout.add')}</SectionTitle>
          <View style={styles.types} accessibilityRole="radiogroup">
            {(['bkash', 'nagad'] as const).map((k) => (
              <Pressable
                key={k}
                accessibilityRole="radio"
                accessibilityState={{ selected: type === k, disabled: codeSent }}
                disabled={codeSent}
                onPress={() => setType(k)}
                style={[styles.type, { borderColor: type === k ? theme.brand : theme.line, backgroundColor: type === k ? theme.backgroundSelected : theme.backgroundElement }]}>
                <ThemedText type="smallBold" style={{ color: type === k ? theme.brandText : theme.text }}>
                  {t(`pay.${k}`)}
                </ThemedText>
              </Pressable>
            ))}
          </View>
          <Field label={t('payout.number')} value={number} onChangeText={setNumber} keyboardType="phone-pad" editable={!codeSent} placeholder="01XXXXXXXXX" maxLength={16} />
          <Field label={t('payout.name')} value={name} onChangeText={setName} editable={!codeSent} maxLength={120} autoComplete="name" />
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: declared }} disabled={codeSent} onPress={() => setDeclared(!declared)} style={styles.declare}>
            <MaterialCommunityIcons name={declared ? 'checkbox-marked' : 'checkbox-blank-outline'} size={24} color={declared ? theme.brand : theme.textSecondary} />
            <ThemedText type="small" style={{ flex: 1 }}>
              {t('payout.declare')}
            </ThemedText>
          </Pressable>
          {!codeSent ? (
            <Button title={t('payout.sendCode')} busy={busy} onPress={() => void send()} />
          ) : (
            <>
              <Field label={t('payout.code')} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" textContentType="oneTimeCode" />
              <Button title={t('payout.submit')} busy={busy} onPress={() => /^\d{6}$/.test(code) && void submit()} />
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12 },
  types: { flexDirection: 'row', gap: 8 },
  type: { flex: 1, minHeight: 48, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  declare: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
});
