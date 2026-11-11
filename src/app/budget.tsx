import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { closeModal, ModalHeader } from '../components/ModalHeader';
import { AmountInput, Button, Chip, IconBubble } from '../components/ui';
import { getCategory } from '../lib/categories';
import { addMonths, currentMonth } from '../lib/dates';
import { summarize, txOfMonth } from '../lib/finance';
import { formatBRL } from '../lib/money';
import { tap } from '../lib/platform';
import { colors, radius, space } from '../lib/theme';
import { useFinance } from '../store/useFinance';

export default function BudgetScreen() {
  const { categoryId = 'total' } = useLocalSearchParams<{ categoryId?: string }>();
  const insets = useSafeAreaInsets();
  const isTotal = categoryId === 'total';
  const transactions = useFinance((s) => s.transactions);
  const current = useFinance((s) => (isTotal ? s.settings.monthlyLimit : (s.categoryBudgets[categoryId] ?? 0)));
  const updateSettings = useFinance((s) => s.updateSettings);
  const setCategoryBudget = useFinance((s) => s.setCategoryBudget);
  const [value, setValue] = useState(current);

  const cat = isTotal ? null : getCategory(categoryId);

  // Média dos últimos 3 meses fechados, como sugestão
  const average = useMemo(() => {
    const months = [1, 2, 3].map((i) => addMonths(currentMonth(), -i));
    const totals = months.map((m) => {
      const txs = txOfMonth(transactions, m).filter((t) => t.type === 'expense' && (isTotal || t.categoryId === categoryId));
      return summarize(txs).expense;
    });
    const withData = totals.filter((t) => t > 0);
    return withData.length ? Math.round(withData.reduce((a, b) => a + b, 0) / withData.length) : 0;
  }, [transactions, categoryId, isTotal]);

  const save = (v: number) => {
    if (isTotal) updateSettings({ monthlyLimit: v });
    else setCategoryBudget(categoryId, v);
    tap('success');
    closeModal();
  };

  const presets = isTotal ? [150000, 250000, 400000, 600000] : [20000, 50000, 80000, 150000];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={isTotal ? 'Limite mensal' : 'Limite da categoria'} />
      <ScrollView contentContainerStyle={{ padding: space.lg }} keyboardShouldPersistTaps="handled">
        <View style={s.head}>
          {cat ? <IconBubble icon={cat.icon} color={cat.color} size={56} /> : <IconBubble icon="wallet" color={colors.primary} size={56} />}
          <Text style={s.title}>{cat ? cat.name : 'Quanto quer gastar por mês?'}</Text>
          <Text style={s.text}>
            {isTotal
              ? 'Esse limite vale para todos os meses e soma todas as suas despesas.'
              : 'Você será avisado quando chegar a 80% do limite desta categoria.'}
          </Text>
        </View>
        <View style={s.amountCard}>
          <AmountInput value={value} onChange={setValue} color={colors.primaryDark} autoFocus testID="budget-input" />
        </View>
        <View style={s.chips}>
          {presets.map((p) => (
            <Chip key={p} label={formatBRL(p)} selected={value === p} onPress={() => setValue(p)} />
          ))}
        </View>
        {average > 0 && (
          <Text style={s.avg} onPress={() => setValue(average)}>
            Sua média nos últimos meses: <Text style={{ fontWeight: '800', color: colors.primary }}>{formatBRL(average)}</Text> (toque para usar)
          </Text>
        )}
      </ScrollView>
      <View style={[s.footer, { paddingBottom: insets.bottom + space.lg }]}>
        <Button testID="save-budget" label="Salvar limite" icon="checkmark" onPress={() => save(value)} disabled={value <= 0} />
        {current > 0 && <Button label="Remover limite" variant="ghost" onPress={() => save(0)} style={{ marginTop: space.sm }} />}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  head: { alignItems: 'center', marginTop: space.md },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: space.md, textAlign: 'center' },
  text: { fontSize: 14, color: colors.textSoft, textAlign: 'center', marginTop: space.sm, lineHeight: 20, paddingHorizontal: space.lg },
  amountCard: { backgroundColor: colors.card, borderRadius: radius.lg, paddingVertical: space.xl, marginVertical: space.xl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  avg: { textAlign: 'center', color: colors.textSoft, marginTop: space.md, fontSize: 14 },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border },
});
