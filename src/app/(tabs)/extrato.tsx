import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Fab } from '../../components/Fab';
import { Button, Card, Chip, EmptyState, MonthSwitcher, Screen, ScreenTitle, TransactionRow } from '../../components/ui';
import { getCategory } from '../../lib/categories';
import { currentMonth, dayLabel } from '../../lib/dates';
import { groupByDay, summarize, txOfMonth } from '../../lib/finance';
import { formatBRL } from '../../lib/money';
import { colors, radius, space } from '../../lib/theme';
import type { TxType } from '../../lib/types';
import { useFinance } from '../../store/useFinance';

export default function Extrato() {
  const transactions = useFinance((s) => s.transactions);
  const [month, setMonth] = useState(currentMonth());
  const [filter, setFilter] = useState<'all' | TxType>('all');
  const [query, setQuery] = useState('');

  const monthTx = useMemo(() => txOfMonth(transactions, month), [transactions, month]);
  const summary = useMemo(() => summarize(monthTx), [monthTx]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return monthTx.filter(
      (t) =>
        (filter === 'all' || t.type === filter) &&
        (!q || t.note.toLowerCase().includes(q) || getCategory(t.categoryId).name.toLowerCase().includes(q)),
    );
  }, [monthTx, filter, query]);
  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <ScreenTitle
          title="Extrato"
          subtitle="Tudo que entrou e saiu, dia a dia."
          help={{
            intro: 'Aqui fica a lista de todos os seus lançamentos do mês.',
            items: [
              { icon: 'chevron-forward', text: 'Use as setas para ver outros meses.' },
              { icon: 'search', text: 'Busque pelo nome ou pela categoria, ou filtre só despesas ou receitas.' },
              { icon: 'create-outline', text: 'Toque em um lançamento para corrigir o valor, a data ou excluir.' },
              { icon: 'repeat', text: '“Fixa” é uma conta lançada sozinha. “Parcela 2/6” é parte de uma compra parcelada.' },
            ],
          }}
        />
        <MonthSwitcher month={month} onChange={setMonth} maxMonth={currentMonth()} />

        <View style={s.summary}>
          <SummaryItem label="Receitas" value={summary.income} color={colors.income} />
          <View style={s.divider} />
          <SummaryItem label="Despesas" value={summary.expense} color={colors.expense} />
          <View style={s.divider} />
          <SummaryItem label="Saldo" value={summary.balance} color={summary.balance >= 0 ? colors.primaryDark : colors.expense} />
        </View>

        <View style={s.search}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por descrição ou categoria"
            placeholderTextColor={colors.textMuted}
            style={s.searchInput}
          />
        </View>
        <View style={{ flexDirection: 'row', marginBottom: space.sm }}>
          <Chip label="Todos" selected={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip label="Despesas" selected={filter === 'expense'} color={colors.expense} onPress={() => setFilter('expense')} />
          <Chip label="Receitas" selected={filter === 'income'} onPress={() => setFilter('income')} />
        </View>

        {groups.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title={monthTx.length === 0 ? 'Nenhum lançamento neste mês' : 'Nada encontrado'}
            text={monthTx.length === 0 ? 'Registre seus gastos e receitas para acompanhar tudo por aqui.' : 'Tente outro filtro ou busca.'}
            action={
              monthTx.length === 0 ? (
                <Button label="Registrar agora" icon="add" onPress={() => router.push({ pathname: '/transaction', params: { type: 'expense' } })} />
              ) : undefined
            }
          />
        ) : (
          groups.map((g) => (
            <View key={g.date}>
              <View style={s.dayHeader}>
                <Text style={s.dayLabel}>{dayLabel(g.date)}</Text>
                <Text style={[s.dayNet, { color: g.net >= 0 ? colors.income : colors.textSoft }]}>{formatBRL(g.net, { sign: true })}</Text>
              </View>
              <Card style={{ paddingVertical: space.xs, paddingHorizontal: space.md, marginBottom: space.md }}>
                {g.items.map((t) => (
                  <TransactionRow key={t.id} tx={t} onPress={() => router.push({ pathname: '/transaction', params: { id: t.id } })} />
                ))}
              </Card>
            </View>
          ))
        )}
      </Screen>
      <Fab testID="fab-add" label="Novo lançamento" onPress={() => router.push({ pathname: '/transaction', params: { type: 'expense' } })} />
    </View>
  );
}

function SummaryItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={s.sumLabel}>{label}</Text>
      <Text style={[s.sumValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {formatBRL(value)}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: space.lg,
    paddingHorizontal: space.sm,
    marginBottom: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  divider: { width: 1, backgroundColor: colors.border },
  sumLabel: { fontSize: 12, color: colors.textSoft, marginBottom: 4 },
  sumValue: { fontSize: 15, fontWeight: '800' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: space.md,
  },
  searchInput: { flex: 1, paddingVertical: 11, paddingHorizontal: space.sm, fontSize: 15, color: colors.text },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.sm, marginTop: space.xs },
  dayLabel: { fontSize: 14, fontWeight: '700', color: colors.textSoft, textTransform: 'capitalize' },
  dayNet: { fontSize: 13, fontWeight: '700' },
});
