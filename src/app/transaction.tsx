import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { closeModal, ModalHeader } from '../components/ModalHeader';
import { AmountInput, Button, Chip, Field } from '../components/ui';
import { categoriesOf, DEFAULT_CATEGORY, getCategory } from '../lib/categories';
import { addDays, addMonthsToDate, dayLabel, monthOf, monthShort, shortDate, todayKey } from '../lib/dates';
import { formatBRL } from '../lib/money';
import { splitInstallments } from '../lib/planning';
import { chooseAction, confirmAction, tap } from '../lib/platform';
import { colors, radius, space } from '../lib/theme';
import type { TxType } from '../lib/types';
import { useFinance } from '../store/useFinance';

const INSTALLMENT_OPTIONS = [1, 2, 3, 4, 5, 6, 10, 12];

type Params = { id?: string; type?: TxType; categoryId?: string; note?: string; date?: string };

export default function TransactionScreen() {
  const params = useLocalSearchParams<Params>();
  const insets = useSafeAreaInsets();
  const existing = useFinance((s) => (params.id ? s.transactions.find((t) => t.id === params.id) : undefined));
  const addTransaction = useFinance((s) => s.addTransaction);
  const updateTransaction = useFinance((s) => s.updateTransaction);
  const removeTransaction = useFinance((s) => s.removeTransaction);
  const addInstallmentPurchase = useFinance((s) => s.addInstallmentPurchase);
  const removeInstallmentGroup = useFinance((s) => s.removeInstallmentGroup);
  const recurringName = useFinance((s) => (existing?.recurringId ? s.recurring.find((r) => r.id === existing.recurringId)?.name : undefined));

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

  const [installments, setInstallments] = useState(1);

  const isEdit = !!existing;
  const canSplit = !isEdit && type === 'expense';
  const n = canSplit ? installments : 1;
  const parts = n > 1 && amount > 0 ? splitInstallments(amount, n) : [];
  const accent = type === 'income' ? colors.income : colors.expense;

  const changeType = (t: TxType) => {
    setType(t);
    if (getCategory(categoryId).type !== t) setCategoryId(DEFAULT_CATEGORY[t]);
  };

  const save = () => {
    if (amount <= 0) return;
    const data = { type, amount, categoryId, note: note.trim(), date };
    if (isEdit) updateTransaction(existing.id, data);
    else if (n > 1) addInstallmentPurchase({ amount, categoryId, note: note.trim(), date }, n);
    else addTransaction(data);
    tap('success');
    closeModal();
  };

  const remove = async () => {
    if (!existing) return;
    if (existing.installment) {
      const choice = await chooseAction(
        'Excluir parcela?',
        `Esta é a parcela ${existing.installment.index} de ${existing.installment.total}.`,
        ['Excluir só esta parcela', 'Excluir todas as parcelas'],
      );
      if (choice === 0) removeTransaction(existing.id);
      if (choice === 1) removeInstallmentGroup(existing.installment.groupId);
      if (choice >= 0) closeModal();
      return;
    }
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

        {existing?.installment && (
          <View style={s.info}>
            <Ionicons name="layers-outline" size={18} color={colors.primaryDark} />
            <Text style={s.infoText}>
              Parcela {existing.installment.index} de {existing.installment.total} de uma compra de {formatBRL(existing.installment.purchaseTotal)}. As
              mudanças valem só para esta parcela.
            </Text>
          </View>
        )}
        {existing?.recurringId && (
          <Pressable style={s.info} onPress={() => router.push('/recurring')}>
            <Ionicons name="repeat" size={18} color={colors.primaryDark} />
            <Text style={s.infoText}>
              Lançado automaticamente{recurringName ? ` por “${recurringName}”` : ''}. Para mudar todos os meses, edite em Contas fixas e renda.
            </Text>
          </Pressable>
        )}

        <View style={s.amountCard}>
          <Text style={s.label}>{n > 1 ? 'Valor total da compra' : 'Valor'}</Text>
          <AmountInput value={amount} onChange={setAmount} color={accent} autoFocus={!isEdit} testID="amount-input" />
          {parts.length > 1 && (
            <Text style={s.splitText} testID="split-summary">
              {n}x de {formatBRL(parts[parts.length - 1])} · de {monthShort(monthOf(date))} a {monthShort(monthOf(addMonthsToDate(date, n - 1)))}
            </Text>
          )}
        </View>

        {canSplit && (
          <>
            <Text style={s.label}>Pagamento</Text>
            <Text style={s.helpLine}>Parcelado? O app cria uma parcela por mês e já reserva cada uma.</Text>
            <View style={[s.chips, { marginBottom: space.md }]}>
              {INSTALLMENT_OPTIONS.map((opt) => (
                <Chip key={opt} label={opt === 1 ? 'À vista' : `${opt}x`} selected={installments === opt} onPress={() => setInstallments(opt)} />
              ))}
            </View>
          </>
        )}

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
          label={isEdit ? 'Salvar alterações' : n > 1 ? `Registrar ${n} parcelas` : 'Registrar'}
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
  helpLine: { fontSize: 13, color: colors.textSoft, marginTop: -4, marginBottom: space.sm, lineHeight: 18 },
  info: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.lg,
  },
  infoText: { flex: 1, fontSize: 13, color: colors.primaryDeep, lineHeight: 19 },
  splitText: { marginTop: space.sm, fontSize: 14, fontWeight: '700', color: colors.textSoft },
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
