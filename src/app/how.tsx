import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { closeModal, ModalHeader } from '../components/ModalHeader';
import { Button } from '../components/ui';
import { dayMonth, shortDate, todayKey } from '../lib/dates';
import { formatBRL } from '../lib/money';
import { cyclePlan, type PlanLine } from '../lib/planning';
import { colors, radius, space } from '../lib/theme';
import { useFinance } from '../store/useFinance';

/** Explica, com os números do próprio usuário, de onde vem o valor do dia. */
export default function HowScreen() {
  const insets = useSafeAreaInsets();
  const transactions = useFinance((s) => s.transactions);
  const recurring = useFinance((s) => s.recurring);
  const monthlyLimit = useFinance((s) => s.settings.monthlyLimit);
  const today = todayKey();
  const plan = useMemo(() => cyclePlan(transactions, recurring, monthlyLimit, today), [transactions, recurring, monthlyLimit, today]);

  const spentBefore = plan.variableSpent - plan.spentToday;
  const lines = (items: PlanLine[]) =>
    items.map((l, i) => (
      <View key={`${l.label}-${l.date}-${i}`} style={s.line}>
        <Text style={s.lineLabel} numberOfLines={1}>
          {l.label}
        </Text>
        <Text style={s.lineDate}>
          {dayMonth(l.date)}
          {l.pending ? ' · previsto' : ''}
        </Text>
        <Text style={s.lineAmount}>{formatBRL(l.amount)}</Text>
      </View>
    ));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title="Como calculamos" />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xl }}>
        {plan.dailyBase === null ? (
          <View style={s.card}>
            <Text style={s.cardTitle}>Falta saber quanto você recebe</Text>
            <Text style={s.text}>
              Cadastre sua renda e suas contas fixas, ou defina um limite mensal de gastos. Aí o app passa a calcular quanto você pode gastar por dia.
            </Text>
            <Button label="Cadastrar renda e contas" icon="repeat" onPress={() => router.replace('/recurring')} style={{ marginTop: space.md }} />
          </View>
        ) : (
          <>
            <View style={s.periodCard}>
              <Text style={s.periodLabel}>{plan.mode === 'payday' ? 'Período entre recebimentos' : 'Mês atual'}</Text>
              <Text style={s.periodValue}>
                {shortDate(plan.start)} a {shortDate(plan.end)}
              </Text>
              <Text style={s.periodNote}>
                {plan.mode === 'payday'
                  ? `A conta vai até a véspera do seu próximo recebimento${plan.nextPay ? ` (${shortDate(plan.nextPay)})` : ''}, e não até o fim do mês.`
                  : 'Cadastre sua renda em Contas fixas e renda para a conta seguir os seus recebimentos.'}
              </Text>
            </View>

            <View style={s.card}>
              <Text style={s.cardTitle}>1. Dinheiro que entrou</Text>
              {plan.incomeLines.length ? lines(plan.incomeLines) : <Text style={s.text}>Nenhuma receita neste período.</Text>}
              <View style={s.total}>
                <Text style={s.totalLabel}>Total que entrou</Text>
                <Text style={s.totalValue}>{formatBRL(plan.income)}</Text>
              </View>
            </View>

            <View style={s.card}>
              <Text style={s.cardTitle}>2. O que já tem dono</Text>
              <Text style={s.text}>Contas fixas e parcelas que vencem neste período, mesmo as que ainda não chegaram.</Text>
              {lines(plan.fixedLines)}
              {lines(plan.installmentLines)}
              {plan.fixedLines.length + plan.installmentLines.length === 0 && <Text style={s.text}>Nada reservado neste período.</Text>}
              <View style={s.total}>
                <Text style={s.totalLabel}>Total reservado</Text>
                <Text style={s.totalValue}>- {formatBRL(plan.recurringExpense + plan.installments)}</Text>
              </View>
            </View>

            {plan.limit > 0 && (
              <View style={s.card}>
                <Text style={s.cardTitle}>Seu limite de gastos</Text>
                <Text style={s.text}>
                  Você definiu um limite de {formatBRL(monthlyLimit)} por mês, que vale {formatBRL(plan.limit)} neste período.{' '}
                  {plan.source === 'both' ? 'Entre a sobra da renda e o limite, o app usa o menor dos dois.' : 'Sem renda cadastrada, a conta usa o limite.'}
                </Text>
              </View>
            )}

            <View style={[s.card, s.result]}>
              <Text style={s.cardTitle}>3. Sobra para o dia a dia</Text>
              <Text style={s.big}>{formatBRL(plan.budget ?? 0)}</Text>
              <Text style={s.text}>
                Desse valor, você já gastou {formatBRL(spentBefore)} antes de hoje. Restam {formatBRL(Math.max(0, (plan.budget ?? 0) - spentBefore))} para{' '}
                {plan.daysLeft} {plan.daysLeft === 1 ? 'dia' : 'dias'}, contando hoje.
              </Text>
              <View style={s.formula}>
                <Text style={s.formulaText}>
                  {formatBRL(Math.max(0, (plan.budget ?? 0) - spentBefore))} ÷ {plan.daysLeft} = <Text style={s.formulaStrong}>{formatBRL(plan.dailyBase)}</Text>{' '}
                  por dia
                </Text>
              </View>
              {plan.spentToday > 0 && (
                <Text style={s.text}>
                  Hoje você já gastou {formatBRL(plan.spentToday)}, então ainda cabem {formatBRL(Math.max(0, plan.todayLeft ?? 0))}.
                </Text>
              )}
            </View>

            <View style={s.tips}>
              <View style={s.tipRow}>
                <Ionicons name="refresh" size={18} color={colors.primaryDark} />
                <Text style={s.tipText}>Gastou menos hoje? O valor de amanhã sobe. Gastou mais? Ele desce e se ajusta sozinho.</Text>
              </View>
              <View style={s.tipRow}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.primaryDark} />
                <Text style={s.tipText}>Contas fixas e parcelas ficam reservadas: o valor do dia já desconta elas.</Text>
              </View>
              <Pressable style={s.tipRow} onPress={() => router.replace('/recurring')}>
                <Ionicons name="create-outline" size={18} color={colors.primaryDark} />
                <Text style={[s.tipText, { color: colors.primary, fontWeight: '700' }]}>Corrigir renda ou contas fixas</Text>
              </Pressable>
            </View>
          </>
        )}
        <Button label="Entendi" variant="ghost" onPress={closeModal} style={{ marginTop: space.md }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  periodCard: { backgroundColor: colors.primaryDark, borderRadius: radius.lg, padding: space.lg, marginBottom: space.md },
  periodLabel: { color: colors.primarySoft, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  periodValue: { color: colors.white, fontSize: 22, fontWeight: '800', marginTop: 4 },
  periodNote: { color: colors.primarySoft, fontSize: 13, lineHeight: 19, marginTop: 6 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, marginBottom: space.md, borderWidth: 1, borderColor: colors.border },
  result: { borderColor: colors.primary, borderWidth: 2 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 6 },
  text: { fontSize: 14, color: colors.textSoft, lineHeight: 20, marginTop: 4 },
  line: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, gap: space.sm, borderTopWidth: 1, borderTopColor: colors.border },
  lineLabel: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '600' },
  lineDate: { fontSize: 12, color: colors.textMuted },
  lineAmount: { fontSize: 14, fontWeight: '700', color: colors.text, minWidth: 92, textAlign: 'right' },
  total: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.sm, paddingTop: space.sm, borderTopWidth: 2, borderTopColor: colors.border },
  totalLabel: { fontSize: 14, fontWeight: '800', color: colors.text },
  totalValue: { fontSize: 16, fontWeight: '800', color: colors.text },
  big: { fontSize: 34, fontWeight: '900', color: colors.primaryDark, marginVertical: 4 },
  formula: { backgroundColor: colors.primaryLight, borderRadius: radius.md, padding: space.md, marginTop: space.md },
  formulaText: { fontSize: 15, color: colors.primaryDeep, textAlign: 'center' },
  formulaStrong: { fontWeight: '900', fontSize: 17 },
  tips: { gap: space.md, marginTop: space.xs, marginBottom: space.md },
  tipRow: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  tipText: { flex: 1, fontSize: 14, color: colors.textSoft, lineHeight: 20 },
});
