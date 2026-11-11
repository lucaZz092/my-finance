import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, IconBubble, ProgressBar, Screen, SectionTitle, TransactionRow } from '../../components/ui';
import { getCategory } from '../../lib/categories';
import { currentMonth, dayLabel, greeting, monthLabel, todayKey, weekdayInitial } from '../../lib/dates';
import {
  activeDays,
  bestStreak,
  budgetStatus,
  currentStreak,
  dailyAllowance,
  expenseByCategory,
  lastNDays,
  summarize,
  txOfMonth,
} from '../../lib/finance';
import { formatBRL } from '../../lib/money';
import { tap } from '../../lib/platform';
import { ruleBasedParser } from '../../lib/quickEntry';
import { colors, radius, space } from '../../lib/theme';
import { tipOfTheDay } from '../../lib/tips';
import type { Transaction } from '../../lib/types';
import { useFinance } from '../../store/useFinance';

export default function Home() {
  const transactions = useFinance((s) => s.transactions);
  const checkIns = useFinance((s) => s.checkIns);
  const settings = useFinance((s) => s.settings);
  const addTransaction = useFinance((s) => s.addTransaction);
  const removeTransaction = useFinance((s) => s.removeTransaction);
  const checkIn = useFinance((s) => s.checkIn);

  const today = todayKey();
  const month = currentMonth();
  const [quick, setQuick] = useState('');
  const [lastAdded, setLastAdded] = useState<Transaction | null>(null);

  const monthTx = useMemo(() => txOfMonth(transactions, month), [transactions, month]);
  const summary = useMemo(() => summarize(monthTx), [monthTx]);
  const byCat = useMemo(() => expenseByCategory(monthTx).slice(0, 4), [monthTx]);
  const days = useMemo(() => activeDays(transactions, checkIns), [transactions, checkIns]);
  const streak = currentStreak(days, today);
  const best = bestStreak(days);
  const week = lastNDays(today, 7);
  const doneToday = days.has(today);
  const recent = useMemo(
    () => [...transactions].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1)).slice(0, 5),
    [transactions],
  );

  const limit = settings.monthlyLimit;
  const allowance = dailyAllowance(limit, summary.expense, month, today);
  const status = budgetStatus(summary.expense, limit);
  const statusColor = status === 'over' ? colors.expense : status === 'warning' ? colors.warning : colors.primary;

  const submitQuick = async () => {
    const text = quick.trim();
    if (!text) return;
    const parsed = await ruleBasedParser.parse(text, today);
    if (!parsed.amount) {
      // Sem valor: abre o formulário já preenchido
      router.push({ pathname: '/transaction', params: { type: parsed.type, categoryId: parsed.categoryId, note: parsed.note, date: parsed.date } });
      setQuick('');
      return;
    }
    const tx = addTransaction({
      type: parsed.type,
      amount: parsed.amount,
      categoryId: parsed.categoryId,
      note: parsed.note,
      date: parsed.date,
    });
    tap('success');
    setLastAdded(tx);
    setQuick('');
  };

  return (
    <Screen>
      {/* Cabeçalho */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.hello}>
            {greeting()}
            {settings.name ? `, ${settings.name}` : ''}!
          </Text>
          <Text style={s.sub}>{monthLabel(month)}</Text>
        </View>
        <View style={s.streakPill} accessibilityLabel={`Sequência de ${streak} dias`}>
          <Ionicons name="flame" size={18} color={streak > 0 ? '#FF7A00' : colors.textMuted} />
          <Text style={s.streakPillText}>{streak}</Text>
        </View>
      </View>

      {/* Saldo */}
      <View style={s.hero}>
        <Text style={s.heroLabel}>Saldo do mês</Text>
        <Text style={s.heroValue} testID="balance">
          {formatBRL(summary.balance)}
        </Text>
        <View style={s.heroRow}>
          <View style={s.heroItem}>
            <View style={[s.heroIcon, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
              <Ionicons name="arrow-down" size={16} color={colors.white} />
            </View>
            <View>
              <Text style={s.heroSmall}>Receitas</Text>
              <Text style={s.heroAmount}>{formatBRL(summary.income)}</Text>
            </View>
          </View>
          <View style={s.heroItem}>
            <View style={[s.heroIcon, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
              <Ionicons name="arrow-up" size={16} color={colors.white} />
            </View>
            <View>
              <Text style={s.heroSmall}>Despesas</Text>
              <Text style={s.heroAmount}>{formatBRL(summary.expense)}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Lançamento rápido */}
      <Card>
        <Text style={s.cardTitle}>Registro rápido</Text>
        <View style={s.quickRow}>
          <TextInput
            testID="quick-input"
            value={quick}
            onChangeText={setQuick}
            placeholder='Ex: "almoço 32,50" ou "uber 18 ontem"'
            placeholderTextColor={colors.textMuted}
            style={s.quickInput}
            returnKeyType="send"
            onSubmitEditing={submitQuick}
            selectionColor={colors.primary}
          />
          <Pressable testID="quick-send" onPress={submitQuick} style={[s.quickBtn, !quick.trim() && { opacity: 0.4 }]} disabled={!quick.trim()}>
            <Ionicons name="arrow-forward" size={22} color={colors.white} />
          </Pressable>
        </View>
        {lastAdded && (
          <View style={s.added} testID="quick-feedback">
            <IconBubble icon={getCategory(lastAdded.categoryId).icon} color={getCategory(lastAdded.categoryId).color} size={32} />
            <View style={{ flex: 1, marginLeft: space.sm }}>
              <Text style={[s.addedTitle, { color: lastAdded.type === 'income' ? colors.income : colors.text }]} numberOfLines={1}>
                {lastAdded.type === 'income' ? '+' : '-'} {formatBRL(lastAdded.amount)} ✓
              </Text>
              <Text style={s.addedSub} numberOfLines={1}>
                {lastAdded.type === 'income' ? 'Receita' : 'Despesa'} · {getCategory(lastAdded.categoryId).name}
                {lastAdded.date !== today ? ` · ${dayLabel(lastAdded.date)}` : ''}
              </Text>
            </View>
            <Pressable
              hitSlop={8}
              onPress={() => {
                router.push({ pathname: '/transaction', params: { id: lastAdded.id } });
                setLastAdded(null);
              }}
            >
              <Text style={s.link}>Editar</Text>
            </Pressable>
            <Pressable
              hitSlop={8}
              style={{ marginLeft: space.md }}
              onPress={() => {
                removeTransaction(lastAdded.id);
                setLastAdded(null);
              }}
            >
              <Text style={[s.link, { color: colors.expense }]}>Desfazer</Text>
            </Pressable>
          </View>
        )}
        <View style={s.actions}>
          <Button
            testID="add-expense"
            label="Despesa"
            icon="remove-circle"
            variant="danger"
            style={{ flex: 1 }}
            onPress={() => router.push({ pathname: '/transaction', params: { type: 'expense' } })}
          />
          <Button
            testID="add-income"
            label="Receita"
            icon="add-circle"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => router.push({ pathname: '/transaction', params: { type: 'income' } })}
          />
        </View>
      </Card>

      {/* Hábito */}
      <Card>
        <View style={s.rowBetween}>
          <Text style={s.cardTitle}>Seu hábito</Text>
          <Text style={s.muted}>Recorde: {best} {best === 1 ? 'dia' : 'dias'}</Text>
        </View>
        <Text style={s.habitText}>
          {streak === 0
            ? 'Comece hoje sua sequência registrando seus gastos.'
            : `${streak} ${streak === 1 ? 'dia seguido' : 'dias seguidos'} cuidando do seu dinheiro${doneToday ? '. Mandou bem!' : '. Registre hoje para manter!'}`}
        </Text>
        <View style={s.week}>
          {week.map((d) => {
            const active = days.has(d);
            const isToday = d === today;
            return (
              <View key={d} style={s.weekItem}>
                <View style={[s.weekDot, active && s.weekDotActive, isToday && !active && s.weekDotToday]}>
                  {active && <Ionicons name="checkmark" size={16} color={colors.white} />}
                </View>
                <Text style={[s.weekLabel, isToday && { color: colors.primaryDark, fontWeight: '800' }]}>{weekdayInitial(d)}</Text>
              </View>
            );
          })}
        </View>
        {!doneToday && (
          <Button
            testID="no-spend"
            label="Hoje não gastei nada"
            icon="checkmark-circle"
            variant="secondary"
            onPress={() => {
              checkIn(today);
              tap('success');
            }}
            style={{ marginTop: space.md }}
          />
        )}
      </Card>

      {/* Limite mensal */}
      <Card>
        <View style={s.rowBetween}>
          <Text style={s.cardTitle}>Limite do mês</Text>
          <Pressable hitSlop={8} onPress={() => router.push({ pathname: '/budget', params: { categoryId: 'total' } })}>
            <Text style={s.link}>{limit > 0 ? 'Ajustar' : 'Definir'}</Text>
          </Pressable>
        </View>
        {limit > 0 ? (
          <>
            <Text style={s.limitText}>
              <Text style={{ fontWeight: '800', color: statusColor }}>{formatBRL(summary.expense)}</Text> de {formatBRL(limit)}
            </Text>
            <ProgressBar value={summary.expense / limit} color={statusColor} height={10} />
            <Text style={[s.allowance, { color: status === 'over' ? colors.expense : colors.textSoft }]}>
              {status === 'over'
                ? `Você passou ${formatBRL(summary.expense - limit)} do limite. Bora segurar até o fim do mês!`
                : `Você pode gastar até ${formatBRL(allowance ?? 0)} por dia até o fim do mês.`}
            </Text>
          </>
        ) : (
          <Text style={s.habitText}>Defina quanto quer gastar por mês e veja quanto ainda pode gastar por dia.</Text>
        )}
      </Card>

      {/* Para onde foi o dinheiro */}
      {byCat.length > 0 && (
        <Card>
          <Text style={[s.cardTitle, { marginBottom: space.md }]}>Para onde foi seu dinheiro</Text>
          {byCat.map(({ categoryId, total }) => {
            const cat = getCategory(categoryId);
            return (
              <View key={categoryId} style={{ marginBottom: space.md }}>
                <View style={[s.rowBetween, { marginBottom: 6 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <IconBubble icon={cat.icon} color={cat.color} size={28} />
                    <Text style={s.catName}>{cat.name}</Text>
                  </View>
                  <Text style={s.catValue}>
                    {formatBRL(total)} · {Math.round((total / summary.expense) * 100)}%
                  </Text>
                </View>
                <ProgressBar value={total / summary.expense} color={cat.color} height={6} />
              </View>
            );
          })}
        </Card>
      )}

      {/* Últimos lançamentos */}
      <SectionTitle
        action={
          recent.length > 0 ? (
            <Pressable hitSlop={8} onPress={() => router.push('/extrato')}>
              <Text style={s.link}>Ver tudo</Text>
            </Pressable>
          ) : undefined
        }
      >
        Últimos lançamentos
      </SectionTitle>
      <Card style={{ paddingVertical: space.sm }}>
        {recent.length === 0 ? (
          <Text style={[s.habitText, { textAlign: 'center', paddingVertical: space.lg }]}>
            Nada por aqui ainda. Que tal registrar seu primeiro gasto acima?
          </Text>
        ) : (
          recent.map((t) => <TransactionRow key={t.id} tx={t} onPress={() => router.push({ pathname: '/transaction', params: { id: t.id } })} />)
        )}
      </Card>

      {/* Dica */}
      <View style={s.tip}>
        <Ionicons name="bulb" size={22} color={colors.primaryDark} />
        <View style={{ flex: 1, marginLeft: space.md }}>
          <Text style={s.tipTitle}>Dica do dia</Text>
          <Text style={s.tipText}>{tipOfTheDay()}</Text>
        </View>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: space.lg },
  hello: { fontSize: 24, fontWeight: '800', color: colors.text },
  sub: { fontSize: 14, color: colors.textSoft, marginTop: 2 },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  streakPillText: { fontSize: 16, fontWeight: '800', color: colors.text, marginLeft: 4 },
  hero: { backgroundColor: colors.primaryDark, borderRadius: radius.xl, padding: space.xl, marginBottom: space.lg },
  heroLabel: { color: colors.primarySoft, fontSize: 14, fontWeight: '600' },
  heroValue: { color: colors.white, fontSize: 36, fontWeight: '900', marginTop: 4, marginBottom: space.lg },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between' },
  heroItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  heroIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: space.sm },
  heroSmall: { color: colors.primarySoft, fontSize: 12 },
  heroAmount: { color: colors.white, fontSize: 15, fontWeight: '700' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  quickRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.md },
  quickInput: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: space.sm,
  },
  added: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: space.sm,
    marginTop: space.md,
  },
  addedTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  addedSub: { fontSize: 12, color: colors.textSoft },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  muted: { fontSize: 13, color: colors.textMuted },
  habitText: { fontSize: 14, color: colors.textSoft, marginTop: 6, lineHeight: 20 },
  week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.lg },
  weekItem: { alignItems: 'center' },
  weekDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  weekDotToday: { borderColor: colors.primary, borderWidth: 2, borderStyle: 'dashed' },
  weekLabel: { fontSize: 12, color: colors.textMuted, marginTop: 4, fontWeight: '600' },
  limitText: { fontSize: 15, color: colors.textSoft, marginTop: space.sm, marginBottom: space.sm },
  allowance: { fontSize: 14, marginTop: space.sm, lineHeight: 20 },
  catName: { fontSize: 14, fontWeight: '600', color: colors.text, marginLeft: space.sm },
  catValue: { fontSize: 13, color: colors.textSoft, fontWeight: '600' },
  link: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  tip: {
    flexDirection: 'row',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: space.lg,
    marginTop: space.sm,
    alignItems: 'flex-start',
  },
  tipTitle: { fontSize: 14, fontWeight: '800', color: colors.primaryDark, marginBottom: 2 },
  tipText: { fontSize: 14, color: colors.text, lineHeight: 20 },
});
