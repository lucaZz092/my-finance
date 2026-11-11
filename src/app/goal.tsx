import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { closeModal, ModalHeader } from '../components/ModalHeader';
import { AmountInput, Button, Chip, Field, type IconName } from '../components/ui';
import { addMonths, daysInMonth, monthOf, shortDate, todayKey } from '../lib/dates';
import { confirmAction, tap } from '../lib/platform';
import { colors, radius, space } from '../lib/theme';
import type { DateKey } from '../lib/types';
import { useFinance } from '../store/useFinance';

const ICONS: IconName[] = ['shield-checkmark', 'airplane', 'home', 'car', 'phone-portrait', 'school', 'gift', 'heart', 'laptop', 'trending-up', 'paw', 'star'];
const DEADLINES = [
  { label: 'Sem prazo', months: 0 },
  { label: '3 meses', months: 3 },
  { label: '6 meses', months: 6 },
  { label: '1 ano', months: 12 },
  { label: '2 anos', months: 24 },
];

function deadlineIn(months: number): DateKey | undefined {
  if (!months) return undefined;
  const today = todayKey();
  const m = addMonths(monthOf(today), months);
  const day = Math.min(Number(today.slice(8, 10)), daysInMonth(m));
  return `${m}-${String(day).padStart(2, '0')}`;
}

export default function GoalScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const existing = useFinance((s) => (id ? s.goals.find((g) => g.id === id) : undefined));
  const addGoal = useFinance((s) => s.addGoal);
  const updateGoal = useFinance((s) => s.updateGoal);
  const removeGoal = useFinance((s) => s.removeGoal);

  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState<string>(existing?.icon ?? ICONS[0]);
  const [target, setTarget] = useState(existing?.target ?? 0);
  const [saved, setSaved] = useState(0);
  const [deadline, setDeadline] = useState<DateKey | undefined>(existing?.deadline);
  const [deadlineChoice, setDeadlineChoice] = useState<number | null>(existing ? null : 0);

  const valid = name.trim().length > 0 && target > 0;

  const save = () => {
    if (!valid) return;
    if (existing) updateGoal(existing.id, { name: name.trim(), icon, target, deadline });
    else addGoal({ name: name.trim(), icon, target, deadline, saved });
    tap('success');
    closeModal();
  };

  const remove = async () => {
    if (!existing) return;
    if (await confirmAction('Excluir meta?', `A meta "${existing.name}" será removida.`, 'Excluir')) {
      removeGoal(existing.id);
      closeModal();
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ModalHeader title={existing ? 'Editar meta' : 'Nova meta'} onDelete={existing ? remove : undefined} />
      <ScrollView contentContainerStyle={{ padding: space.lg }} keyboardShouldPersistTaps="handled">
        <Field
          testID="goal-name"
          label="Nome da meta"
          value={name}
          onChangeText={setName}
          placeholder="Ex: Reserva de emergência"
          maxLength={40}
          autoFocus={!existing}
        />

        <Text style={s.label}>Ícone</Text>
        <View style={s.icons}>
          {ICONS.map((i) => (
            <Pressable key={i} onPress={() => setIcon(i)} style={[s.iconBtn, icon === i && s.iconBtnActive]}>
              <Ionicons name={i} size={22} color={icon === i ? colors.white : colors.primaryDark} />
            </Pressable>
          ))}
        </View>

        <Text style={s.label}>Quanto você quer juntar?</Text>
        <View style={s.amountCard}>
          <AmountInput value={target} onChange={setTarget} color={colors.primaryDark} testID="goal-target" />
        </View>

        {!existing && (
          <>
            <Text style={s.label}>Já tem algum valor guardado? (opcional)</Text>
            <View style={s.amountCard}>
              <AmountInput value={saved} onChange={setSaved} size="md" color={colors.textSoft} />
            </View>
          </>
        )}

        <Text style={s.label}>Prazo</Text>
        <View style={s.chips}>
          {DEADLINES.map((d) => (
            <Chip
              key={d.label}
              label={d.label}
              selected={deadlineChoice === d.months}
              onPress={() => {
                setDeadlineChoice(d.months);
                setDeadline(deadlineIn(d.months));
              }}
            />
          ))}
        </View>
        {deadline && <Text style={s.deadline}>Data limite: {shortDate(deadline)}</Text>}
      </ScrollView>
      <View style={[s.footer, { paddingBottom: insets.bottom + space.lg }]}>
        <Button testID="save-goal" label={existing ? 'Salvar alterações' : 'Criar meta'} icon="checkmark" onPress={save} disabled={!valid} />
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '700', color: colors.textSoft, marginBottom: space.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg },
  iconBtn: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  iconBtnActive: { backgroundColor: colors.primary },
  amountCard: { backgroundColor: colors.card, borderRadius: radius.lg, paddingVertical: space.lg, marginBottom: space.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  deadline: { color: colors.textSoft, fontSize: 14, marginTop: space.xs },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border },
});
