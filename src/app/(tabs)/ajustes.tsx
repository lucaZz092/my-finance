import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Card, Chip, type IconName, Screen, SectionTitle, Title } from '../../components/ui';
import { getCategory } from '../../lib/categories';
import { todayKey } from '../../lib/dates';
import { activeDays, bestStreak, toCSV } from '../../lib/finance';
import { formatBRL } from '../../lib/money';
import { confirmAction, notify } from '../../lib/platform';
import { syncDailyReminder } from '../../lib/reminders';
import { colors, radius, space } from '../../lib/theme';
import { useFinance } from '../../store/useFinance';

const HOURS = [8, 9, 12, 18, 19, 20, 21, 22];

export default function Ajustes() {
  const settings = useFinance((s) => s.settings);
  const transactions = useFinance((s) => s.transactions);
  const checkIns = useFinance((s) => s.checkIns);
  const updateSettings = useFinance((s) => s.updateSettings);
  const resetAll = useFinance((s) => s.resetAll);
  const [name, setName] = useState(settings.name);
  const [busy, setBusy] = useState(false);

  const days = useMemo(() => activeDays(transactions, checkIns), [transactions, checkIns]);

  const setReminder = async (enabled: boolean, hour = settings.reminderHour) => {
    setBusy(true);
    const result = await syncDailyReminder(enabled, hour, 0);
    setBusy(false);
    if (enabled && result === 'denied') {
      notify('Permissão negada', 'Ative as notificações do My Finance nas configurações do Android para receber o lembrete.');
      updateSettings({ reminderEnabled: false });
      return;
    }
    if (enabled && result === 'unsupported') {
      notify('Indisponível', 'Lembretes funcionam apenas no app instalado no celular.');
    }
    updateSettings({ reminderEnabled: enabled && result !== 'denied', reminderHour: hour, reminderMinute: 0 });
  };

  const exportCSV = async () => {
    if (transactions.length === 0) {
      notify('Nada para exportar', 'Você ainda não tem lançamentos.');
      return;
    }
    const csv = toCSV(transactions, (id) => getCategory(id).name);
    try {
      await Share.share({ title: 'My Finance - lançamentos', message: csv });
    } catch {
      notify('Erro', 'Não foi possível compartilhar os dados.');
    }
  };

  const reset = async () => {
    const ok = await confirmAction(
      'Apagar todos os dados?',
      'Todos os lançamentos, metas e limites serão apagados deste aparelho. Essa ação não pode ser desfeita.',
      'Apagar tudo',
    );
    if (!ok) return;
    await syncDailyReminder(false, 0, 0);
    resetAll();
    router.replace('/onboarding');
  };

  return (
    <Screen>
      <Title>Ajustes</Title>

      <View style={s.stats}>
        <Stat icon="receipt" value={String(transactions.length)} label="lançamentos" />
        <Stat icon="calendar" value={String(days.size)} label="dias ativos" />
        <Stat icon="flame" value={String(bestStreak(days))} label="recorde" />
      </View>

      <SectionTitle>Perfil</SectionTitle>
      <Card>
        <Text style={s.label}>Seu nome</Text>
        <TextInput
          testID="settings-name"
          value={name}
          onChangeText={setName}
          onEndEditing={() => updateSettings({ name: name.trim() })}
          onBlur={() => updateSettings({ name: name.trim() })}
          style={s.input}
          placeholder="Como quer ser chamado"
          placeholderTextColor={colors.textMuted}
          maxLength={30}
        />
        <Pressable style={s.linkRow} onPress={() => router.push({ pathname: '/budget', params: { categoryId: 'total' } })}>
          <Ionicons name="wallet-outline" size={20} color={colors.primary} />
          <Text style={s.linkText}>Limite mensal de gastos</Text>
          <Text style={s.linkValue}>{settings.monthlyLimit > 0 ? formatBRL(settings.monthlyLimit) : 'Não definido'}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      </Card>

      <SectionTitle>Lembrete diário</SectionTitle>
      <Card>
        <View style={s.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.itemTitle}>Lembrar de registrar gastos</Text>
            <Text style={s.itemSub}>Uma notificação por dia para manter o hábito.</Text>
          </View>
          <Switch
            testID="reminder-switch"
            value={settings.reminderEnabled}
            disabled={busy}
            onValueChange={(v) => setReminder(v)}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={colors.white}
          />
        </View>
        {settings.reminderEnabled && (
          <View style={s.hours}>
            {HOURS.map((h) => (
              <Chip key={h} label={`${h}h`} selected={settings.reminderHour === h} onPress={() => setReminder(true, h)} />
            ))}
          </View>
        )}
      </Card>

      <SectionTitle>Dados</SectionTitle>
      <Card style={{ paddingVertical: space.xs }}>
        <Row icon="share-outline" title="Exportar lançamentos (CSV)" onPress={exportCSV} />
        <Row icon="trash-outline" title="Apagar todos os dados" danger onPress={reset} />
      </Card>

      <View style={s.about}>
        <View style={s.logo}>
          <Ionicons name="leaf" size={22} color={colors.white} />
        </View>
        <Text style={s.aboutTitle}>My Finance · versão 1.0 (MVP)</Text>
        <Text style={s.aboutText}>Seus dados ficam salvos apenas neste aparelho. Hoje: {todayKey().split('-').reverse().join('/')}</Text>
      </View>
    </Screen>
  );
}

function Stat({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  return (
    <View style={s.stat}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function Row({ icon, title, onPress, danger }: { icon: IconName; title: string; onPress: () => void; danger?: boolean }) {
  const color = danger ? colors.expense : colors.text;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.row, pressed && { opacity: 0.6 }]}>
      <Ionicons name={icon} size={20} color={danger ? colors.expense : colors.primary} />
      <Text style={[s.rowText, { color }]}>{title}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  stats: { flexDirection: 'row', gap: space.md, marginBottom: space.lg },
  stat: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: space.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  statValue: { fontSize: 22, fontWeight: '900', color: colors.text, marginTop: 4 },
  statLabel: { fontSize: 12, color: colors.textSoft },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSoft, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 11,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  linkRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.lg, gap: space.sm },
  linkText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  linkValue: { fontSize: 14, color: colors.textSoft },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
  itemTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  itemSub: { fontSize: 13, color: colors.textSoft, marginTop: 2 },
  hours: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.md },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: space.md },
  rowText: { flex: 1, fontSize: 15, fontWeight: '600' },
  about: { alignItems: 'center', marginTop: space.lg },
  logo: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  aboutTitle: { fontSize: 14, fontWeight: '700', color: colors.textSoft },
  aboutText: { fontSize: 12, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
});
