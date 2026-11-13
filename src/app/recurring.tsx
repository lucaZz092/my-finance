import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/ScreenHeader';
import { Card, Chip, IconBubble, SectionTitle } from '../components/ui';
import { getCategory } from '../lib/categories';
import { currentMonth, dateInMonth, monthShort, monthOf, todayKey } from '../lib/dates';
import { formatBRL } from '../lib/money';
import { activeInstallmentGroups, isPosted, monthPlan } from '../lib/planning';
import { colors, radius, space } from '../lib/theme';
import type { RecurringItem, TxType } from '../lib/types';
import { useFinance } from '../store/useFinance';

const SUGGESTIONS: { name: string; categoryId: string }[] = [
  { name: 'Aluguel', categoryId: 'home' },
  { name: 'Condomínio', categoryId: 'home' },
  { name: 'Luz', categoryId: 'home' },
  { name: 'Água', categoryId: 'home' },
  { name: 'Internet', categoryId: 'home' },
  { name: 'Celular', categoryId: 'subscriptions' },
  { name: 'Academia', categoryId: 'health' },
  { name: 'Streaming', categoryId: 'subscriptions' },
  { name: 'Plano de saúde', categoryId: 'health' },
  { name: 'Faculdade', categoryId: 'education' },
];

export default function RecurringScreen() {
  const insets = useSafeAreaInsets();
  const recurring = useFinance((s) => s.recurring);
  const transactions = useFinance((s) => s.transactions);
  const monthlyLimit = useFinance((s) => s.settings.monthlyLimit);
  const today = todayKey();
  const month = currentMonth();

  const plan = useMemo(() => monthPlan(transactions, recurring, monthlyLimit, month, today), [transactions, recurring, monthlyLimit, month, today]);
  const groups = useMemo(() => activeInstallmentGroups(transactions, today), [transactions, today]);
  const incomes = recurring.filter((r) => r.type === 'income').sort((a, b) => a.dayOfMonth - b.dayOfMonth);
  const expenses = recurring.filter((r) => r.type === 'expense').sort((a, b) => a.dayOfMonth - b.dayOfMonth);
  const usedNames = new Set(expenses.map((e) => e.name.toLowerCase()));

  const add = (type: TxType, name?: string, categoryId?: string) =>
    router.push({ pathname: '/recurring-edit', params: { type, ...(name ? { name } : {}), ...(categoryId ? { categoryId } : {}) } });

  const status = (r: RecurringItem) => {
    if (!r.active) return 'pausada';
    if (isPosted(r, transactions, month)) return r.type === 'income' ? 'recebida' : 'lançada';
    const date = dateInMonth(month, r.dayOfMonth);
    const days = Number(date.slice(8, 10)) - Number(today.slice(8, 10));
    return days === 0 ? 'entra hoje' : `em ${days} ${days === 1 ? 'dia' : 'dias'}`;
  };

  const row = (r: RecurringItem) => {
    const cat = getCategory(r.categoryId);
    return (
      <Pressable
        key={r.id}
        testID={`recurring-${r.name}`}
        onPress={() => router.push({ pathname: '/recurring-edit', params: { id: r.id } })}
        style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.primaryLight }, !r.active && { opacity: 0.5 }]}
      >
        <IconBubble icon={cat.icon} color={cat.color} />
        <View style={{ flex: 1, marginLeft: space.md }}>
          <Text style={s.rowTitle}>{r.name}</Text>
          <Text style={s.rowSub}>
            Todo dia {r.dayOfMonth} · {status(r)}
          </Text>
        </View>
        <Text style={[s.rowAmount, r.type === 'income' && { color: colors.income }]}>
          {r.type === 'income' ? '+' : '-'} {formatBRL(r.amount)}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Contas fixas e renda" />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + 48 }}>
        <View style={s.summary}>
          <Text style={s.summaryLabel}>Neste mês ({monthShort(month)})</Text>
          <View style={s.sumRow}>
            <Text style={s.sumKey}>Renda prevista</Text>
            <Text style={s.sumVal}>{formatBRL(plan.income)}</Text>
          </View>
          <View style={s.sumRow}>
            <Text style={s.sumKey}>Contas fixas</Text>
            <Text style={s.sumVal}>- {formatBRL(plan.recurringExpense)}</Text>
          </View>
          <View style={s.sumRow}>
            <Text style={s.sumKey}>Parcelas</Text>
            <Text style={s.sumVal}>- {formatBRL(plan.installments)}</Text>
          </View>
          <View style={[s.sumRow, s.sumTotal]}>
            <Text style={[s.sumKey, { color: colors.white, fontWeight: '800' }]}>Sobra para o dia a dia</Text>
            <Text style={[s.sumVal, { fontSize: 20 }]} testID="free-budget">
              {plan.budget === null ? '—' : formatBRL(plan.budget)}
            </Text>
          </View>
          {plan.source === 'both' && plan.budget !== null && (
            <Text style={s.summaryNote}>Usando o seu limite mensal, que é menor que a sobra da renda.</Text>
          )}
          {plan.source === 'limit' && <Text style={s.summaryNote}>Sem renda cadastrada: usando o seu limite mensal.</Text>}
        </View>

        <SectionTitle
          action={
            <Pressable hitSlop={8} onPress={() => add('income', 'Salário', 'salary')} testID="add-income-recurring">
              <Text style={s.link}>+ Adicionar</Text>
            </Pressable>
          }
        >
          Renda
        </SectionTitle>
        <Card style={{ paddingVertical: space.xs }}>
          {incomes.length ? (
            incomes.map(row)
          ) : (
            <Pressable style={s.empty} onPress={() => add('income', 'Salário', 'salary')}>
              <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
              <Text style={s.emptyText}>Adicione seu salário ou renda do mês. É com ela que o app calcula quanto você pode gastar por dia.</Text>
            </Pressable>
          )}
        </Card>

        <SectionTitle
          action={
            <Pressable hitSlop={8} onPress={() => add('expense')} testID="add-expense-recurring">
              <Text style={s.link}>+ Adicionar</Text>
            </Pressable>
          }
        >
          Contas fixas
        </SectionTitle>
        <Card style={{ paddingVertical: space.xs }}>
          {expenses.length ? (
            expenses.map(row)
          ) : (
            <Text style={[s.emptyText, { padding: space.md }]}>Aluguel, internet, academia... Elas entram sozinhas no extrato no dia certo.</Text>
          )}
        </Card>
        <View style={s.chips}>
          {SUGGESTIONS.filter((x) => !usedNames.has(x.name.toLowerCase())).map((x) => (
            <Chip key={x.name} label={`+ ${x.name}`} onPress={() => add('expense', x.name, x.categoryId)} />
          ))}
        </View>

        <SectionTitle>Compras parceladas</SectionTitle>
        <Card style={{ paddingVertical: space.xs }}>
          {groups.length ? (
            groups.map((g) => {
              const cat = getCategory(g.categoryId);
              return (
                <Pressable
                  key={g.groupId}
                  onPress={() => g.nextTxId && router.push({ pathname: '/transaction', params: { id: g.nextTxId } })}
                  style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.primaryLight }]}
                >
                  <IconBubble icon={cat.icon} color={cat.color} />
                  <View style={{ flex: 1, marginLeft: space.md }}>
                    <Text style={s.rowTitle}>{g.note || cat.name}</Text>
                    <Text style={s.rowSub}>
                      {g.paid}/{g.total} pagas · até {monthShort(monthOf(g.lastDate))}
                    </Text>
                  </View>
                  <Text style={s.rowAmount}>{formatBRL(g.perMonth)}/mês</Text>
                </Pressable>
              );
            })
          ) : (
            <Text style={[s.emptyText, { padding: space.md }]}>
              Nenhuma compra parcelada. Ao registrar uma despesa, escolha em quantas vezes foi, ou escreva “tênis 600 em 6x”.
            </Text>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  summary: { backgroundColor: colors.primaryDark, borderRadius: radius.xl, padding: space.xl, marginBottom: space.lg, gap: 8 },
  summaryLabel: { color: colors.primarySoft, fontSize: 14, fontWeight: '600', marginBottom: 4 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sumKey: { color: colors.primarySoft, fontSize: 15 },
  sumVal: { color: colors.white, fontSize: 15, fontWeight: '700' },
  sumTotal: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: 10, marginTop: 4 },
  summaryNote: { color: colors.primarySoft, fontSize: 12, marginTop: 4 },
  link: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderRadius: radius.sm },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowSub: { fontSize: 13, color: colors.textSoft, marginTop: 2 },
  rowAmount: { fontSize: 15, fontWeight: '700', color: colors.text, marginLeft: space.sm },
  empty: { flexDirection: 'row', gap: space.sm, alignItems: 'center', padding: space.md },
  emptyText: { flex: 1, fontSize: 14, color: colors.textSoft, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: -4, marginBottom: space.md },
});
