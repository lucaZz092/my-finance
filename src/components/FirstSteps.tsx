import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '../lib/theme';
import { ProgressBar } from './ui';

export interface Step {
  id: string;
  label: string;
  hint: string;
  done: boolean;
  to: string;
}

/**
 * Primeiros passos: mostra o que falta para o app funcionar bem.
 * Some sozinho quando tudo estiver feito, ou se a pessoa dispensar.
 */
export function FirstSteps({ steps, onDismiss }: { steps: Step[]; onDismiss: () => void }) {
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  if (!next) return null;

  return (
    <View style={s.card} testID="first-steps">
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Primeiros passos</Text>
          <Text style={s.count}>
            {done} de {steps.length} prontos
          </Text>
        </View>
        <Pressable hitSlop={10} onPress={onDismiss} accessibilityLabel="Dispensar primeiros passos" testID="dismiss-steps">
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </Pressable>
      </View>
      <View style={{ marginVertical: space.md }}>
        <ProgressBar value={done / steps.length} height={6} />
      </View>
      {steps.map((step) => (
        <Pressable
          key={step.id}
          testID={`step-${step.id}`}
          disabled={step.done}
          onPress={() => router.push(step.to as never)}
          style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.primaryLight }]}
        >
          <View style={[s.check, step.done && s.checkDone]}>
            {step.done ? <Ionicons name="checkmark" size={15} color={colors.white} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.label, step.done && s.labelDone]}>{step.label}</Text>
            {!step.done && <Text style={s.hint}>{step.hint}</Text>}
          </View>
          {!step.done && <Ionicons name="chevron-forward" size={18} color={colors.primary} />}
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.lg,
    borderWidth: 2,
    borderColor: colors.primarySoft,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  count: { fontSize: 13, color: colors.textSoft, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10, paddingHorizontal: 4, borderRadius: radius.sm },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { fontSize: 15, fontWeight: '600', color: colors.text },
  labelDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  hint: { fontSize: 13, color: colors.textSoft, marginTop: 2, lineHeight: 18 },
});
