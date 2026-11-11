import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Fab } from '../../components/Fab';
import { AmountInput, Button, Card, EmptyState, IconBubble, ProgressBar, Screen, Title } from '../../components/ui';
import { shortDate, todayKey } from '../../lib/dates';
import { goalProgress, monthlyToReachGoal } from '../../lib/finance';
import { formatBRL } from '../../lib/money';
import { tap } from '../../lib/platform';
import { colors, radius, space } from '../../lib/theme';
import type { Goal } from '../../lib/types';
import { useFinance } from '../../store/useFinance';

export default function Metas() {
  const goals = useFinance((s) => s.goals);
  const totalSaved = goals.reduce((a, g) => a + g.saved, 0);
  const totalTarget = goals.reduce((a, g) => a + g.target, 0);

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Title>Metas</Title>
        {goals.length === 0 ? (
          <EmptyState
            icon="flag-outline"
            title="Crie sua primeira meta"
            text="Reserva de emergência, viagem, celular novo... Metas com valor e prazo te ajudam a guardar com constância."
            action={<Button testID="create-goal" label="Criar meta" icon="add" onPress={() => router.push('/goal')} />}
          />
        ) : (
          <>
            <View style={s.total}>
              <Text style={s.totalLabel}>Total guardado</Text>
              <Text style={s.totalValue}>{formatBRL(totalSaved)}</Text>
              <ProgressBar value={totalTarget ? totalSaved / totalTarget : 0} color={colors.accent} height={8} />
              <Text style={s.totalSub}>de {formatBRL(totalTarget)} em {goals.length} {goals.length === 1 ? 'meta' : 'metas'}</Text>
            </View>
            {goals.map((g) => (
              <GoalCard key={g.id} goal={g} />
            ))}
          </>
        )}
      </Screen>
      {goals.length > 0 && <Fab testID="fab-goal" label="Nova meta" onPress={() => router.push('/goal')} />}
    </View>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  const contribute = useFinance((s) => s.contributeToGoal);
  const [mode, setMode] = useState<null | 'add' | 'remove'>(null);
  const [value, setValue] = useState(0);
  const progress = goalProgress(goal.saved, goal.target);
  const done = goal.saved >= goal.target;
  const perMonth = monthlyToReachGoal(goal.saved, goal.target, goal.deadline, todayKey());

  const confirm = () => {
    if (value <= 0 || !mode) return;
    contribute(goal.id, mode === 'add' ? value : -Math.min(value, goal.saved));
    tap('success');
    setMode(null);
    setValue(0);
  };

  return (
    <Card>
      <Pressable style={s.head} onPress={() => router.push({ pathname: '/goal', params: { id: goal.id } })}>
        <IconBubble icon={goal.icon} color={colors.primary} size={44} />
        <View style={{ flex: 1, marginLeft: space.md }}>
          <Text style={s.name}>{goal.name}</Text>
          <Text style={s.sub}>{goal.deadline ? `Até ${shortDate(goal.deadline)}` : 'Sem prazo'}</Text>
        </View>
        <Ionicons name="create-outline" size={20} color={colors.textMuted} />
      </Pressable>

      <View style={s.values}>
        <Text style={s.saved}>{formatBRL(goal.saved)}</Text>
        <Text style={s.sub}>de {formatBRL(goal.target)}</Text>
      </View>
      <ProgressBar value={progress} height={10} />
      <Text style={[s.sub, { marginTop: space.sm }]}>
        {done
          ? '🎉 Meta alcançada! Parabéns pela disciplina.'
          : `${Math.round(progress * 100)}% · faltam ${formatBRL(goal.target - goal.saved)}${perMonth ? ` · guarde ${formatBRL(perMonth)}/mês` : ''}`}
      </Text>

      {mode ? (
        <View style={s.panel}>
          <Text style={s.panelTitle}>{mode === 'add' ? 'Quanto você guardou?' : 'Quanto você retirou?'}</Text>
          <AmountInput value={value} onChange={setValue} size="md" color={mode === 'add' ? colors.primaryDark : colors.expense} autoFocus />
          <View style={s.row}>
            <Button label="Cancelar" variant="ghost" style={{ flex: 1 }} onPress={() => (setMode(null), setValue(0))} />
            <Button testID="confirm-contribution" label="Confirmar" style={{ flex: 1 }} disabled={value <= 0} onPress={confirm} />
          </View>
        </View>
      ) : (
        <View style={s.row}>
          <Button testID="goal-add" label="Guardar" icon="add" variant="secondary" style={{ flex: 1 }} onPress={() => setMode('add')} />
          <Button label="Retirar" icon="remove" variant="ghost" style={{ flex: 1 }} disabled={goal.saved <= 0} onPress={() => setMode('remove')} />
        </View>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  total: { backgroundColor: colors.primaryDark, borderRadius: radius.xl, padding: space.xl, marginBottom: space.lg },
  totalLabel: { color: colors.primarySoft, fontSize: 14, fontWeight: '600' },
  totalValue: { color: colors.white, fontSize: 32, fontWeight: '900', marginVertical: space.sm },
  totalSub: { color: colors.primarySoft, fontSize: 13, marginTop: space.sm },
  head: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 17, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.textSoft, marginTop: 2 },
  values: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: space.lg, marginBottom: space.sm },
  saved: { fontSize: 22, fontWeight: '800', color: colors.primaryDark },
  row: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  panel: { backgroundColor: colors.bg, borderRadius: radius.md, padding: space.md, marginTop: space.md },
  panelTitle: { fontSize: 14, fontWeight: '700', color: colors.textSoft, textAlign: 'center', marginBottom: space.sm },
});
