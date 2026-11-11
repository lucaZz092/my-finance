import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { closeModal, ModalHeader } from '../components/ModalHeader';
import { AmountInput, Button, Chip, Field } from '../components/ui';
import { categoriesOf, DEFAULT_CATEGORY, getCategory } from '../lib/categories';
import { addDays, dayLabel, shortDate, todayKey } from '../lib/dates';
import { confirmAction, tap } from '../lib/platform';
import { colors, radius, space } from '../lib/theme';
import type { TxType } from '../lib/types';
import { useFinance } from '../store/useFinance';

type Params = { id?: string; type?: TxType; categoryId?: string; note?: string; date?: string };

export default function TransactionScreen() {
  const params = useLocalSearchParams<Params>();
  const insets = useSafeAreaInsets();
  const existing = useFinance((s) => (params.id ? s.transactions.find((t) => t.id === params.id) : undefined));
  const addTransaction = useFinance((s) => s.addTransaction);
  const updateTransaction = useFinance((s) => s.updateTransaction);
  const removeTransaction = useFinance((s) => s.removeTransaction);

  const today = todayKey();
  const initialType: TxType = existing?.type ?? (params.type === 'income' ? 'income' : 'expense');
  const [type, setType] = useState<TxType>(initialType);
  const [amount, setAmount] = useState(existing?.amount ?? 0);
  const [categoryId, setCategoryId] = useState<string>(() => {
    const c = existing?.categoryId ?? params.categoryId;
    return c && getCategory(c).type === initialType ? c : DEFAULT_CATEGORY[initialType];
  });
  const [note, setNote] = useState(existing?.note ?? params.note ?? '');
  const [date, setDate] = useState(existing?.date ?? (params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today));

  const isEdit = !!existing;
  const accent = type === 'income' ? colors.income : colors.expense;

  const changeType = (t: TxType) => {
    setType(t);
    if (getCategory(categoryId).type !== t) setCategoryId(DEFAULT_CATEGORY[t]);
  };

  const save = () => {
    if (amount <= 0) return;
    const data = { type, amount, categoryId, note: note.trim(), date };
    if (isEdit) updateTransaction(existing.id, data);
    else addTransaction(data);
    tap('success');
    closeModal();
  };

  const remove = async () => {
    if (!existing) return;
    if (await confirmAction('Excluir lançamento?', 'Essa ação não pode ser desfeita.', 'Excluir')) {
      removeTransaction(existing.id);
      closeModal();
    }
  };

  if (params.id && !existing) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ModalHeader title="Lançamento" />
        <Text style={{ textAlign: 'center', marginTop: 40, color: colors.textSoft }}>Este lançamento não existe mais.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ModalHeader title={isEdit ? 'Editar lançamento' : type === 'income' ? 'Nova receita' : 'Nova despesa'} onDelete={isEdit ? remove : undefined} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xl }} keyboardShouldPersistTaps="handled">
        <View style={s.segment}>
          {(['expense', 'income'] as const).map((t) => (
            <Pressable
              key={t}
              testID={`type-${t}`}
              onPress={() => changeType(t)}
              style={[s.segBtn, type === t && { backgroundColor: t === 'income' ? colors.income : colors.expense }]}
            >
              <Text style={[s.segText, type === t && { color: colors.white }]}>{t === 'income' ? 'Receita' : 'Despesa'}</Text>
            </Pressable>
          ))}
        </View>

        <View style={s.amountCard}>
          <Text style={s.label}>Valor</Text>
          <AmountInput value={amount} onChange={setAmount} color={accent} autoFocus={!isEdit} testID="amount-input" />
        </View>

        <Text style={s.label}>Categoria</Text>
        <View style={s.chips}>
          {categoriesOf(type).map((c) => (
            <Chip key={c.id} label={c.name} icon={c.icon} color={c.color} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
          ))}
        </View>

        <Text style={[s.label, { marginTop: space.md }]}>Data</Text>
        <View style={s.dateRow}>
          <Pressable testID="date-prev" hitSlop={8} style={s.dateBtn} onPress={() => setDate(addDays(date, -1))}>
            <Ionicons name="chevron-back" size={20} color={colors.primaryDark} />
          </Pressable>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={s.dateMain}>{dayLabel(date)}</Text>
            <Text style={s.dateSub}>{shortDate(date)}</Text>
          </View>
          <Pressable
            testID="date-next"
            hitSlop={8}
            style={[s.dateBtn, date >= today && { opacity: 0.3 }]}
            disabled={date >= today}
            onPress={() => setDate(addDays(date, 1))}
          >
            <Ionicons name="chevron-forward" size={20} color={colors.primaryDark} />
          </Pressable>
        </View>
        <View style={[s.chips, { marginBottom: space.md }]}>
          <Chip label="Hoje" selected={date === today} onPress={() => setDate(today)} />
          <Chip label="Ontem" selected={date === addDays(today, -1)} onPress={() => setDate(addDays(today, -1))} />
        </View>

        <Field
          testID="note-input"
          label="Descrição (opcional)"
          value={note}
          onChangeText={setNote}
          placeholder={type === 'income' ? 'Ex: Salário de novembro' : 'Ex: Almoço com a equipe'}
          maxLength={60}
          returnKeyType="done"
          onSubmitEditing={save}
        />
      </ScrollView>
      <View style={[s.footer, { paddingBottom: insets.bottom + space.lg }]}>
        <Button
          testID="save-transaction"
          label={isEdit ? 'Salvar alterações' : 'Registrar'}
          icon="checkmark"
          onPress={save}
          disabled={amount <= 0}
          style={{ backgroundColor: accent, borderColor: accent }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  segment: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.md, padding: 4, borderWidth: 1, borderColor: colors.border },
  segBtn: { flex: 1, paddingVertical: 11, borderRadius: radius.sm, alignItems: 'center' },
  segText: { fontSize: 15, fontWeight: '700', color: colors.textSoft },
  amountCard: { backgroundColor: colors.card, borderRadius: radius.lg, paddingVertical: space.xl, marginVertical: space.lg, alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSoft, marginBottom: space.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: space.sm,
    marginBottom: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  dateMain: { fontSize: 16, fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
  dateSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
});
