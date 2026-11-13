import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, IconBubble, MonthSwitcher, ProgressBar, Screen, SectionTitle, Title } from '../../components/ui';
import { categoriesOf } from '../../lib/categories';
import { addMonths, currentMonth, monthShort, todayKey } from '../../lib/dates';
import { budgetStatus, expenseByCategory, savingsRate, summarize, txOfMonth } from '../../lib/finance';
import { committedByMonth, monthPlan } from '../../lib/planning';
import { formatBRL } from '../../lib/money';
import { colors, radius, space } from '../../lib/theme';
import { useFinance } from '../../store/useFinance';

const statusColor = (st: 'ok' | 'warning' | 'over') => (st === 'over' ? colors.expense : st === 'warning' ? colors.warning : colors.primary);

export default function Orcamento() {
  const transactions = useFinance((s) => s.transactions);
  const budgets = useFinance((s) => s.categoryBudgets);
  const limit = useFinance((s) => s.settings.monthlyLimit);
  const recurring = useFinance((s) => s.recurring);
  const [month, setMonth] = useState(currentMonth());

  const monthTx = useMemo(() => txOfMonth(transactions, month), [transactions, month]);
  const summary = useMemo(() => summarize(monthTx), [monthTx]);
  const spentByCat = useMemo(() => new Map(expenseByCategory(monthTx).map((x) => [x.categoryId, x.total])), [monthTx]);
  const plan = useMemo(() => monthPlan(transactions, recurring, limit, month, todayKey()), [transactions, recurring, limit, month]);
  const allowance = plan.dailyBase;
  const fixedPerMonth = recurring.filter((r) => r.active && r.type === 'expense').reduce((a, r) => a + r.amount, 0);
  const upcoming = useMemo(() => committedByMonth(transactions, addMonths(currentMonth(), 1), 3), [transactions]);
  const hasUpcoming = fixedPerMonth > 0 || upcoming.some((u) => u.total > 0);
  const totalStatus = budgetStatus(summary.expense, limit);
  const rate = savingsRate(summary);

  const cats = categoriesOf('expense');
  const withBudget = cats.filter((c) => budgets[c.id]);
  const without = cats
    .filter((c) => !budgets[c.id])
    .sort((a, b) => (spentByCat.get(b.id) ?? 0) - (spentByCat.get(a.id) ?? 0));

  const edit = (categoryId: string) => router.push({ pathname: '/budget', params: { categoryId } });

  return (
    <Screen>
      <Title>Orçamento</Title>
      <MonthSwitcher month={month} onChange={setMonth} />

      <Pressable onPress={() => edit('total')} testID="edit-total">
        <Card>
          <View style={s.rowBetween}>
            <Text style={s.cardTitle}>Limite mensal de gastos</Text>
            <Ionicons name="create-outline" size={20} color={colors.primary} />
          </View>
          {limit > 0 ? (
            <>
              <View style={[s.rowBetween, { marginTop: space.md, marginBottom: space.sm }]}>
                <Text style={[s.big, { color: statusColor(totalStatus) }]}>{formatBRL(summary.expense)}</Text>
                <Text style={s.of}>de {formatBRL(limit)}</Text>
              </View>
              <ProgressBar value={summary.expense / limit} color={statusColor(totalStatus)} height={12} />
              <Text style={s.hint}>
                {totalStatus === 'over'
                  ? `Limite estourado em ${formatBRL(summary.expense - limit)}.`
                  : allowance !== null
                    ? `Restam ${formatBRL(limit - summary.expense)} — cerca de ${formatBRL(allowance)} por dia.`
                    : `Sobraram ${formatBRL(limit - summary.expense)} do limite neste mês.`}
              </Text>
            </>
          ) : (
            <Text style={s.hint}>Toque para definir quanto você quer gastar por mês.</Text>
          )}
        </Card>
      </Pressable>

      {rate !== null && (
        <Card style={s.rateCard}>
          <IconBubble icon={rate >= 0.2 ? 'trophy' : rate >= 0 ? 'trending-up' : 'alert-circle'} color={rate >= 0 ? colors.primary : colors.expense} />
          <View style={{ flex: 1, marginLeft: space.md }}>
            <Text style={s.cardTitle}>Você guardou {Math.round(rate * 100)}% da renda</Text>
            <Text style={s.hint}>
              {rate >= 0.2
                ? 'Excelente! Você está acima da meta de 20% sugerida pela regra 50-30-20.'
                : rate >= 0
                  ? 'A regra 50-30-20 sugere guardar 20% da renda. Você está no caminho!'
                  : 'Neste mês você gastou mais do que ganhou. Veja onde dá para cortar.'}
            </Text>
          </View>
        </Card>
      )}

      <Pressable onPress={() => router.push('/recurring')} testID="upcoming-card">
        <Card>
          <View style={s.rowBetween}>
            <Text style={s.cardTitle}>Já comprometido nos próximos meses</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.primary} />
          </View>
          {hasUpcoming ? (
            upcoming.map((u) => (
              <View key={u.month} style={[s.rowBetween, s.upRow]}>
                <Text style={s.upMonth}>{monthShort(u.month)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.upDetail}>Fixas {formatBRL(fixedPerMonth)}</Text>
                  <Text style={s.upDetail}>Parcelas {formatBRL(u.total)}</Text>
                </View>
                <Text style={s.upTotal}>{formatBRL(fixedPerMonth + u.total)}</Text>
              </View>
            ))
          ) : (
            <Text style={s.hint}>Cadastre contas fixas e compras parceladas para ver quanto dos próximos meses já tem dono.</Text>
          )}
        </Card>
      </Pressable>

      <SectionTitle>Limites por categoria</SectionTitle>
      {withBudget.length === 0 && (
        <Text style={[s.hint, { marginBottom: space.md }]}>
          Defina limites nas categorias que mais pesam no seu bolso. Toque em uma categoria abaixo.
        </Text>
      )}
      {withBudget.map((c) => {
        const spent = spentByCat.get(c.id) ?? 0;
        const lim = budgets[c.id];
        const st = budgetStatus(spent, lim);
        return (
          <Pressable key={c.id} onPress={() => edit(c.id)}>
            <Card style={{ paddingVertical: space.md }}>
              <View style={s.catRow}>
                <IconBubble icon={c.icon} color={c.color} size={38} />
                <View style={{ flex: 1, marginLeft: space.md }}>
                  <View style={s.rowBetween}>
                    <Text style={s.catName}>{c.name}</Text>
                    {st !== 'ok' && (
                      <View style={[s.badge, { backgroundColor: st === 'over' ? colors.expenseLight : colors.warningLight }]}>
                        <Text style={[s.badgeText, { color: statusColor(st) }]}>{st === 'over' ? 'Estourou' : 'Atenção'}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.catSub}>
                    {formatBRL(spent)} de {formatBRL(lim)}
                  </Text>
                </View>
              </View>
              <View style={{ marginTop: space.sm }}>
                <ProgressBar value={spent / lim} color={statusColor(st)} />
              </View>
            </Card>
          </Pressable>
        );
      })}

      <SectionTitle>Sem limite definido</SectionTitle>
      <Card style={{ paddingVertical: space.xs }}>
        {without.map((c, i) => (
          <Pressable key={c.id} onPress={() => edit(c.id)} style={[s.plainRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
            <IconBubble icon={c.icon} color={c.color} size={34} />
            <Text style={[s.catName, { flex: 1, marginLeft: space.md }]}>{c.name}</Text>
            {(spentByCat.get(c.id) ?? 0) > 0 && <Text style={s.catSub}>{formatBRL(spentByCat.get(c.id)!)}</Text>}
            <Ionicons name="add-circle-outline" size={22} color={colors.primary} style={{ marginLeft: space.sm }} />
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  big: { fontSize: 26, fontWeight: '900' },
  of: { fontSize: 14, color: colors.textSoft },
  hint: { fontSize: 14, color: colors.textSoft, marginTop: space.sm, lineHeight: 20 },
  upRow: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 6 },
  upMonth: { fontSize: 15, fontWeight: '800', color: colors.text, width: 70 },
  upDetail: { fontSize: 13, color: colors.textSoft, lineHeight: 18 },
  upTotal: { fontSize: 15, fontWeight: '800', color: colors.text },
  rateCard: { flexDirection: 'row', alignItems: 'center' },
  catRow: { flexDirection: 'row', alignItems: 'center' },
  catName: { fontSize: 15, fontWeight: '600', color: colors.text },
  catSub: { fontSize: 13, color: colors.textSoft, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  badgeText: { fontSize: 11, fontWeight: '800' },
  plainRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
});
