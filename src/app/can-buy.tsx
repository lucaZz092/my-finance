import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { closeModal, ModalHeader } from '../components/ModalHeader';
import { AmountInput, Button, Chip, type IconName } from '../components/ui';
import { categoriesOf } from '../lib/categories';
import { currentMonth, monthShort, todayKey } from '../lib/dates';
import { formatBRL } from '../lib/money';
import { canIBuy, monthPlan } from '../lib/planning';
import { tap } from '../lib/platform';
import { colors, radius, space } from '../lib/theme';
import { useFinance } from '../store/useFinance';

const OPTIONS = [1, 2, 3, 4, 6, 10, 12];

const VERDICT: Record<'today' | 'month' | 'no', { icon: IconName; title: string; color: string; bg: string }> = {
  today: { icon: 'checkmark-circle', title: 'Cabe no seu dia', color: colors.primaryDark, bg: colors.primaryLight },
  month: { icon: 'alert-circle', title: 'Cabe no mês, mas aperta os próximos dias', color: '#8A5A00', bg: colors.warningLight },
  no: { icon: 'close-circle', title: 'Não cabe neste mês', color: colors.expense, bg: colors.expenseLight },
};

export default function CanBuyScreen() {
  const insets = useSafeAreaInsets();
  const transactions = useFinance((s) => s.transactions);
  const recurring = useFinance((s) => s.recurring);
  const monthlyLimit = useFinance((s) => s.settings.monthlyLimit);
  const addTransaction = useFinance((s) => s.addTransaction);
  const addInstallmentPurchase = useFinance((s) => s.addInstallmentPurchase);

  const today = todayKey();
  const [price, setPrice] = useState(0);
  const [n, setN] = useState(1);
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState('shopping');

  const plan = useMemo(() => monthPlan(transactions, recurring, monthlyLimit, currentMonth(), today), [transactions, recurring, monthlyLimit, today]);
  const result = useMemo(() => canIBuy(plan, price, n, today), [plan, price, n, today]);
  const v = result.verdict === 'unknown' ? null : VERDICT[result.verdict];

  const buy = () => {
    if (price <= 0) return;
    const p = { amount: price, categoryId, note: note.trim(), date: today };
    if (n > 1) addInstallmentPurchase(p, n);
    else addTransaction({ ...p, type: 'expense' });
    tap('success');
    closeModal();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ModalHeader title="Posso comprar?" />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xl }} keyboardShouldPersistTaps="handled">
        <View style={s.amountCard}>
          <Text style={s.label}>Quanto custa?</Text>
          <AmountInput value={price} onChange={setPrice} color={colors.text} autoFocus testID="buy-price" />
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="O que é? (opcional)"
            placeholderTextColor={colors.textMuted}
            style={s.noteInput}
            maxLength={40}
            testID="buy-note"
          />
        </View>

        <Text style={s.label}>Como vai pagar?</Text>
        <View style={s.chips}>
          {OPTIONS.map((o) => (
            <Chip key={o} label={o === 1 ? 'À vista' : `${o}x`} selected={n === o} onPress={() => setN(o)} />
          ))}
        </View>

        {price > 0 && result.verdict === 'unknown' && (
          <View style={[s.result, { backgroundColor: colors.card }]}>
            <Text style={s.resultTitle}>Falta saber quanto você recebe</Text>
            <Text style={s.resultText}>Cadastre sua renda e contas fixas, ou um limite mensal, para o app responder.</Text>
            <Button label="Cadastrar renda e contas" variant="secondary" onPress={() => router.replace('/recurring')} style={{ marginTop: space.md }} />
          </View>
        )}

        {price > 0 && v && (
          <View style={[s.result, { backgroundColor: v.bg }]} testID="buy-verdict">
            <View style={s.resultHead}>
              <Ionicons name={v.icon} size={28} color={v.color} />
              <Text style={[s.resultTitle, { color: v.color, flex: 1 }]}>{v.title}</Text>
            </View>
            {result.verdict === 'no' ? (
              <Text style={s.resultText}>
                {n > 1 ? `A 1ª parcela de ${formatBRL(result.thisMonth)}` : 'A compra'} passa {formatBRL(result.over)} do que sobra para o mês.
                {n === 1 ? ' Parcelar ou esperar o próximo mês pode ajudar.' : ''}
              </Text>
            ) : (
              <Text style={s.resultText}>
                Seu valor por dia vai de <Text style={s.bold}>{formatBRL(result.dailyBefore ?? 0)}</Text> para{' '}
                <Text style={s.bold}>{formatBRL(result.dailyAfter ?? 0)}</Text> até o fim do mês ({plan.daysLeft}{' '}
                {plan.daysLeft === 1 ? 'dia' : 'dias'}).
              </Text>
            )}
            {result.future.length > 0 && (
              <View style={s.future}>
                <Text style={s.futureTitle}>
                  {n}x de {formatBRL(result.future[result.future.length - 1].amount)} · ocupa até {monthShort(result.future[result.future.length - 1].month)}
                </Text>
                <Text style={s.resultText}>
                  Nos próximos {result.future.length} meses, {formatBRL(result.future[0].amount)} por mês já sai do seu dia a dia.
                </Text>
              </View>
            )}
          </View>
        )}

        {price > 0 && (
          <>
            <Text style={[s.label, { marginTop: space.lg }]}>Se for comprar, categoria</Text>
            <View style={s.chips}>
              {categoriesOf('expense').map((c) => (
                <Chip key={c.id} label={c.name} icon={c.icon} color={c.color} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
      <View style={[s.footer, { paddingBottom: insets.bottom + space.lg }]}>
        <Button
          testID="buy-register"
          label={n > 1 ? `Comprei: registrar ${n} parcelas` : 'Comprei: registrar gasto'}
          icon="bag-check"
          onPress={buy}
          disabled={price <= 0}
        />
        <Button label="Não vou comprar" variant="ghost" onPress={closeModal} style={{ marginTop: space.sm }} />
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  amountCard: { backgroundColor: colors.card, borderRadius: radius.lg, paddingVertical: space.xl, paddingHorizontal: space.lg, marginBottom: space.lg, alignItems: 'center' },
  noteInput: {
    marginTop: space.lg,
    alignSelf: 'stretch',
    textAlign: 'center',
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: space.md,
  },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSoft, marginBottom: space.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  result: { borderRadius: radius.lg, padding: space.lg, marginTop: space.md, gap: space.sm },
  resultHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  resultTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  resultText: { fontSize: 15, color: colors.text, lineHeight: 22 },
  bold: { fontWeight: '800' },
  future: { borderTopWidth: 1, borderTopColor: 'rgba(15,31,23,0.1)', paddingTop: space.sm, marginTop: space.xs, gap: 4 },
  futureTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border },
});
