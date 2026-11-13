import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { closeModal, ModalHeader } from '../components/ModalHeader';
import { AmountInput, Button, Chip, Field } from '../components/ui';
import { categoriesOf, DEFAULT_CATEGORY, getCategory } from '../lib/categories';
import { confirmAction, tap } from '../lib/platform';
import { colors, radius, space } from '../lib/theme';
import type { TxType } from '../lib/types';
import { useFinance } from '../store/useFinance';

type Params = { id?: string; type?: TxType; name?: string; categoryId?: string };
const DAY_CHIPS = [1, 5, 10, 15, 20, 25];

export default function RecurringEditScreen() {
  const params = useLocalSearchParams<Params>();
  const insets = useSafeAreaInsets();
  const existing = useFinance((s) => (params.id ? s.recurring.find((r) => r.id === params.id) : undefined));
  const addRecurring = useFinance((s) => s.addRecurring);
  const updateRecurring = useFinance((s) => s.updateRecurring);
  const removeRecurring = useFinance((s) => s.removeRecurring);
  const syncRecurring = useFinance((s) => s.syncRecurring);

  const initialType: TxType = existing?.type ?? (params.type === 'income' ? 'income' : 'expense');
  const [type, setType] = useState<TxType>(initialType);
  const [name, setName] = useState(existing?.name ?? params.name ?? '');
  const [amount, setAmount] = useState(existing?.amount ?? 0);
  const [day, setDay] = useState(existing?.dayOfMonth ?? 5);
  const [active, setActive] = useState(existing?.active ?? true);
  const [categoryId, setCategoryId] = useState<string>(() => {
    const c = existing?.categoryId ?? params.categoryId;
    return c && getCategory(c).type === initialType ? c : DEFAULT_CATEGORY[initialType];
  });

  const isEdit = !!existing;
  const valid = name.trim().length > 0 && amount > 0;
  const accent = type === 'income' ? colors.income : colors.expense;

  const changeType = (t: TxType) => {
    setType(t);
    if (getCategory(categoryId).type !== t) setCategoryId(DEFAULT_CATEGORY[t]);
  };

  const save = () => {
    if (!valid) return;
    const data = { type, name: name.trim(), amount, categoryId, dayOfMonth: day, active };
    if (isEdit) updateRecurring(existing.id, data);
    else addRecurring(data);
    syncRecurring();
    tap('success');
    closeModal();
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await confirmAction(
      `Excluir “${existing.name}”?`,
      'Ela para de entrar nos próximos meses. O que já foi lançado continua no extrato.',
      'Excluir',
    );
    if (ok) {
      removeRecurring(existing.id);
      closeModal();
    }
  };

  if (params.id && !existing) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ModalHeader title="Conta fixa" />
        <Text style={{ textAlign: 'center', marginTop: 40, color: colors.textSoft }}>Este item não existe mais.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ModalHeader title={isEdit ? 'Editar' : type === 'income' ? 'Nova renda fixa' : 'Nova conta fixa'} onDelete={isEdit ? remove : undefined} />
      <ScrollView contentContainerStyle={{ padding: space.lg }} keyboardShouldPersistTaps="handled">
        {!isEdit && (
          <View style={s.segment}>
            {(['expense', 'income'] as const).map((t) => (
              <Pressable
                key={t}
                onPress={() => changeType(t)}
                style={[s.segBtn, type === t && { backgroundColor: t === 'income' ? colors.income : colors.expense }]}
              >
                <Text style={[s.segText, type === t && { color: colors.white }]}>{t === 'income' ? 'Renda' : 'Conta fixa'}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={{ height: space.lg }} />
        <Field
          testID="recurring-name"
          label="Nome"
          value={name}
          onChangeText={setName}
          placeholder={type === 'income' ? 'Ex: Salário' : 'Ex: Aluguel'}
          maxLength={40}
        />

        <Text style={s.label}>Valor por mês</Text>
        <View style={s.amountCard}>
          <AmountInput value={amount} onChange={setAmount} color={accent} testID="recurring-amount" autoFocus={!isEdit && !!params.name} />
        </View>

        <Text style={s.label}>Todo dia</Text>
        <View style={s.dayRow}>
          <Pressable style={s.dayBtn} hitSlop={8} onPress={() => setDay((d) => (d <= 1 ? 31 : d - 1))} accessibilityLabel="Dia anterior">
            <Ionicons name="remove" size={22} color={colors.primaryDark} />
          </Pressable>
          <Text style={s.dayValue} testID="recurring-day">
            {day}
          </Text>
          <Pressable style={s.dayBtn} hitSlop={8} onPress={() => setDay((d) => (d >= 31 ? 1 : d + 1))} accessibilityLabel="Próximo dia">
            <Ionicons name="add" size={22} color={colors.primaryDark} />
          </Pressable>
        </View>
        <View style={s.chips}>
          {DAY_CHIPS.map((d) => (
            <Chip key={d} label={`Dia ${d}`} selected={day === d} onPress={() => setDay(d)} />
          ))}
        </View>
        <Text style={s.hint}>
          {day >= 29 ? 'Em meses mais curtos, entra no último dia do mês. ' : ''}
          Se o dia já passou neste mês, ela entra no extrato agora.
        </Text>

        <Text style={[s.label, { marginTop: space.lg }]}>Categoria</Text>
        <View style={s.chips}>
          {categoriesOf(type).map((c) => (
            <Chip key={c.id} label={c.name} icon={c.icon} color={c.color} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
          ))}
        </View>

        {isEdit && (
          <View style={s.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.switchTitle}>Ativa</Text>
              <Text style={s.hint}>Pause para parar de lançar sem apagar.</Text>
            </View>
            <Switch value={active} onValueChange={setActive} trackColor={{ true: colors.primary, false: colors.border }} thumbColor={colors.white} />
          </View>
        )}
      </ScrollView>
      <View style={[s.footer, { paddingBottom: insets.bottom + space.lg }]}>
        <Button testID="save-recurring" label={isEdit ? 'Salvar alterações' : 'Adicionar'} icon="checkmark" onPress={save} disabled={!valid} />
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  segment: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.md, padding: 4, borderWidth: 1, borderColor: colors.border },
  segBtn: { flex: 1, paddingVertical: 11, borderRadius: radius.sm, alignItems: 'center' },
  segText: { fontSize: 15, fontWeight: '700', color: colors.textSoft },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSoft, marginBottom: space.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  amountCard: { backgroundColor: colors.card, borderRadius: radius.lg, paddingVertical: space.lg, marginBottom: space.lg },
  dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xl, marginBottom: space.md },
  dayBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  dayValue: { fontSize: 40, fontWeight: '800', color: colors.text, minWidth: 60, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  hint: { fontSize: 13, color: colors.textSoft, lineHeight: 18 },
  switchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, padding: space.md, marginTop: space.lg },
  switchTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border },
});
