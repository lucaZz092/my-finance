import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FirstSteps, type Step } from '../../components/FirstSteps';
import { Button, Card, HelpSheet, IconBubble, ProgressBar, Screen, SectionTitle, TransactionRow } from '../../components/ui';
import { getCategory } from '../../lib/categories';
import { currentMonth, dayLabel, greeting, monthLabel, shortDate, todayKey, weekdayInitial } from '../../lib/dates';
import { activeDays, bestStreak, currentStreak, expenseByCategory, lastNDays, summarize, txOfMonth } from '../../lib/finance';
import { cyclePlan } from '../../lib/planning';
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
  const addInstallmentPurchase = useFinance((s) => s.addInstallmentPurchase);
  const removeInstallmentGroup = useFinance((s) => s.removeInstallmentGroup);
  const recurring = useFinance((s) => s.recurring);
  const checkIn = useFinance((s) => s.checkIn);
  const updateSettings = useFinance((s) => s.updateSettings);

  const today = todayKey();
  const month = currentMonth();
  const [quick, setQuick] = useState('');
  const [lastAdded, setLastAdded] = useState<Transaction | null>(null);
  const [showHabitHelp, setShowHabitHelp] = useState(false);

  const monthTx = useMemo(() => txOfMonth(transactions, month), [transactions, month]);
  const summary = useMemo(() => summarize(monthTx), [monthTx]);
  const byCat = useMemo(() => expenseByCategory(monthTx).slice(0, 4), [monthTx]);
  const days = useMemo(() => activeDays(transactions, checkIns), [transactions, checkIns]);
  const streak = currentStreak(days, today);
  const best = bestStreak(days);
  const week = lastNDays(today, 7);
  const doneToday = days.has(today);
  const recent = useMemo(
    () =>
      transactions
        .filter((t) => t.date <= today)
        .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
        .slice(0, 5),
    [transactions, today],
  );

  const plan = useMemo(
    () => cyclePlan(transactions, recurring, settings.monthlyLimit, today),
    [transactions, recurring, settings.monthlyLimit, today],
  );
  const over = plan.todayLeft !== null && plan.todayLeft < 0;
  // Contas e parcelas deste período que ainda não aconteceram
  const upcoming = useMemo(
    () => [...plan.fixedLines, ...plan.installmentLines].filter((l) => l.pending).slice(0, 3),
    [plan.fixedLines, plan.installmentLines],
  );
  const hasIncome = recurring.some((r) => r.type === 'income' && r.active);
  const steps: Step[] = [
    { id: 'income', label: 'Informar sua renda', hint: 'Salário, pagamento ou o que você recebe por mês', done: hasIncome, to: '/recurring' },
    {
      id: 'bills',
      label: 'Cadastrar suas contas fixas',
      hint: 'Aluguel, internet, academia: elas entram sozinhas no dia certo',
      done: recurring.some((r) => r.type === 'expense'),
      to: '/recurring',
    },
    { id: 'expense', label: 'Registrar seu primeiro gasto', hint: 'Escreva “almoço 32,50” no campo acima', done: transactions.some((t) => !t.recurringId), to: '/transaction' },
    { id: 'buy', label: 'Experimentar o “Posso comprar?”', hint: 'Veja se uma compra cabe antes de gastar', done: !!settings.triedCanBuy, to: '/can-buy' },
  ];

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
    const tx =
      parsed.installments > 1
        ? addInstallmentPurchase({ amount: parsed.amount, categoryId: parsed.categoryId, note: parsed.note, date: parsed.date }, parsed.installments)
        : addTransaction({
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
        <Pressable
          style={s.streakPill}
          onPress={() => setShowHabitHelp(true)}
          accessibilityRole="button"
          accessibilityLabel={`Sequência de ${streak} dias. Toque para entender`}
          testID="streak-pill"
        >
          <Ionicons name="flame" size={18} color={streak > 0 ? '#FF7A00' : colors.textMuted} />
          <Text style={s.streakPillText}>{streak}</Text>
        </Pressable>
      </View>

      <HelpSheet
        visible={showHabitHelp}
        onClose={() => setShowHabitHelp(false)}
        title="Sua sequência"
        help={{
          intro: 'A chama conta quantos dias seguidos você cuidou do seu dinheiro.',
          items: [
            { icon: 'create-outline', text: 'Registrar qualquer gasto ou receita no dia já conta.' },
            { icon: 'checkmark-circle-outline', text: 'Não gastou nada? Toque em “Hoje não gastei nada” para o dia contar.' },
            { icon: 'flame', text: 'A sequência só quebra se passar um dia inteiro sem registrar.' },
          ],
        }}
      />

      {/* O número do dia */}
      <View style={s.hero} testID="day-hero">
        {plan.dailyBase === null ? (
          <>
            <Text style={s.heroLabel}>Quanto você pode gastar hoje?</Text>
            <Text style={s.heroSetup}>Informe sua renda e suas contas fixas. O app calcula, todo dia, quanto ainda dá para gastar.</Text>
            <Pressable testID="setup-plan" style={s.heroBtn} onPress={() => router.push('/recurring')}>
              <Ionicons name="sparkles" size={18} color={colors.primaryDark} />
              <Text style={s.heroBtnText}>Configurar em 1 minuto</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              testID="how-link"
              style={s.heroLabelRow}
              onPress={() => router.push('/how')}
              accessibilityRole="button"
              accessibilityLabel="Hoje você pode gastar. Toque para ver como calculamos"
            >
              <Text style={s.heroLabel}>Hoje você pode gastar</Text>
              <Ionicons name="information-circle-outline" size={17} color={colors.primarySoft} />
            </Pressable>
            <Text style={[s.heroValue, over && { color: '#FFD48A' }]} testID="day-number">
              {formatBRL(Math.max(0, plan.todayLeft ?? 0))}
            </Text>
            {over ? (
              <Text style={s.heroOver} testID="day-sub">
                Você passou {formatBRL(-(plan.todayLeft ?? 0))} do valor de hoje. Amanhã o app recalcula com o que sobrou.
              </Text>
            ) : (
              <Text style={s.heroSub} testID="day-sub">
                de {formatBRL(plan.dailyBase)} por dia · {plan.daysLeft} {plan.daysLeft === 1 ? 'dia' : 'dias'}{' '}
                {plan.mode === 'payday' ? `até o próximo recebimento (${shortDate(plan.end)})` : `até o fim do mês`}
              </Text>
            )}
            <View style={s.heroTrack}>
              <View
                style={[
                  s.heroFill,
                  { width: `${plan.dailyBase > 0 ? Math.min(100, (plan.spentToday / plan.dailyBase) * 100) : plan.spentToday > 0 ? 100 : 0}%` },
                  over && { backgroundColor: '#FFD48A' },
                ]}
              />
            </View>
            <View style={s.heroRow}>
              <View>
                <Text style={s.heroSmall}>{plan.mode === 'payday' ? 'Até o próximo recebimento' : 'Sobra no mês'}</Text>
                <Text style={s.heroAmount}>{formatBRL(Math.max(0, plan.remaining ?? 0))}</Text>
              </View>
              <View>
                <Text style={s.heroSmall}>Saldo do mês</Text>
                <Text style={s.heroAmount} testID="balance">
                  {formatBRL(summary.balance)}
                </Text>
              </View>
            </View>
            <Pressable
              testID="can-buy"
              style={[s.heroBtn, s.heroBtnWide]}
              onPress={() => {
                updateSettings({ triedCanBuy: true });
                router.push('/can-buy');
              }}
            >
              <Ionicons name="help-circle" size={20} color={colors.primaryDark} />
              <Text style={s.heroBtnText}>Posso comprar?</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* Primeiros passos */}
      {!settings.guideDismissed && <FirstSteps steps={steps} onDismiss={() => updateSettings({ guideDismissed: true })} />}

      {/* Lançamento rápido */}
      <Card>
        <View style={s.rowBetween}>
          <Text style={s.cardTitle}>Registro rápido</Text>
          <Text style={s.muted}>Escreva como você fala</Text>
        </View>
        <View style={s.quickRow}>
          <TextInput
            testID="quick-input"
            value={quick}
            onChangeText={setQuick}
            placeholder='Ex: "almoço 32,50" ou "tênis 600 em 6x"'
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
                {lastAdded.type === 'income' ? '+' : '-'} {formatBRL(lastAdded.installment ? lastAdded.installment.purchaseTotal : lastAdded.amount)} ✓
              </Text>
              <Text style={s.addedSub} numberOfLines={1}>
                {lastAdded.type === 'income' ? 'Receita' : 'Despesa'} · {getCategory(lastAdded.categoryId).name}
                {lastAdded.installment ? ` · ${lastAdded.installment.total}x de ${formatBRL(lastAdded.amount)}` : ''}
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
                if (lastAdded.installment) removeInstallmentGroup(lastAdded.installment.groupId);
                else removeTransaction(lastAdded.id);
                setLastAdded(null);
              }}
            >
              <Text style={[s.link, { color: colors.expense }]}>Desfazer</Text>
            </Pressable>
          </View>
        )}
        {!quick.trim() && !lastAdded && (
          <View style={s.examples}>
            {['almoço 32,50', 'uber 18 ontem', 'recebi salário 3.000', 'tênis 600 em 6x'].map((ex) => (
              <Pressable key={ex} testID={`example-${ex.split(' ')[0]}`} style={s.example} onPress={() => setQuick(ex)}>
                <Text style={s.exampleText}>{ex}</Text>
              </Pressable>
            ))}
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

      {/* Contas fixas do mês */}
      <Card>
        <View style={s.rowBetween}>
          <Text style={[s.cardTitle, { flex: 1, marginRight: space.md }]} numberOfLines={1}>
            {plan.mode === 'payday' ? 'Contas até o recebimento' : 'Contas do mês'}
          </Text>
          <Pressable hitSlop={8} onPress={() => router.push('/recurring')} testID="open-recurring">
            <Text style={s.link}>{recurring.length ? 'Gerenciar' : 'Adicionar'}</Text>
          </Pressable>
        </View>
        {recurring.length === 0 && plan.installments === 0 ? (
          <Text style={s.habitText}>Cadastre aluguel, internet e salário. Eles entram sozinhos no dia certo e deixam o número do dia mais preciso.</Text>
        ) : (
          <>
            <Text style={s.limitText}>
              Fixas <Text style={s.strong}>{formatBRL(plan.recurringExpense)}</Text> · Parcelas <Text style={s.strong}>{formatBRL(plan.installments)}</Text>
            </Text>
            {upcoming.length > 0 ? (
              <>
                <Text style={s.pendingTitle}>Ainda vão sair</Text>
                {upcoming.map((l, i) => (
                  <View key={`${l.label}-${i}`} style={s.pendingRow}>
                    <Text style={s.pendingName} numberOfLines={1}>
                      {l.label}
                    </Text>
                    <Text style={s.pendingDay}>{dayLabel(l.date)}</Text>
                    <Text style={s.pendingAmount}>- {formatBRL(l.amount)}</Text>
                  </View>
                ))}
                <Text style={s.pendingNote}>Esses valores já estão descontados do seu número do dia.</Text>
              </>
            ) : (
              <Text style={s.habitText}>Tudo que é fixo deste período já foi lançado.</Text>
            )}
          </>
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
  heroValue: { color: colors.white, fontSize: 46, fontWeight: '900', marginTop: 2, letterSpacing: -1 },
  heroSub: { color: colors.primarySoft, fontSize: 14, marginTop: 2 },
  heroOver: { color: '#FFD48A', fontSize: 14, marginTop: 2, fontWeight: '600' },
  heroSetup: { color: colors.white, fontSize: 16, lineHeight: 23, marginTop: space.sm, marginBottom: space.lg },
  heroTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', marginTop: space.md, overflow: 'hidden' },
  heroFill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  heroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  heroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  examples: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  example: { backgroundColor: colors.bg, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border },
  exampleText: { fontSize: 13, color: colors.textSoft, fontStyle: 'italic' },
  pendingTitle: { fontSize: 13, fontWeight: '700', color: colors.textSoft, marginTop: space.sm, marginBottom: 2 },
  pendingNote: { fontSize: 12, color: colors.textMuted, marginTop: 6, lineHeight: 17 },
  heroBtnWide: { alignSelf: 'stretch', justifyContent: 'center', marginTop: space.lg, paddingVertical: 13 },
  heroBtnText: { color: colors.primaryDark, fontWeight: '800', fontSize: 14 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.lg, gap: space.lg },
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
  strong: { fontWeight: '800', color: colors.text },
  pendingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: space.sm },
  pendingName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  pendingDay: { fontSize: 12, color: colors.textSoft, textTransform: 'capitalize' },
  pendingAmount: { fontSize: 14, fontWeight: '700', color: colors.text, minWidth: 90, textAlign: 'right' },
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
