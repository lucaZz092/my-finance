import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AmountInput, Button, Chip, type IconName } from '../components/ui';
import { syncDailyReminder } from '../lib/reminders';
import { colors, radius, space } from '../lib/theme';
import { useFinance } from '../store/useFinance';

const STEPS = 4;
const HOURS = [9, 12, 18, 20, 21, 22];
const SALARY_DAYS = [1, 5, 10, 15, 20, 25, 30];

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const updateSettings = useFinance((s) => s.updateSettings);
  const addRecurring = useFinance((s) => s.addRecurring);
  const syncRecurring = useFinance((s) => s.syncRecurring);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [salary, setSalary] = useState(0);
  const [salaryDay, setSalaryDay] = useState(5);
  const [hour, setHour] = useState(20);
  const [saving, setSaving] = useState(false);

  const finish = async (reminder: boolean) => {
    setSaving(true);
    const result = reminder ? await syncDailyReminder(true, hour, 0) : 'ok';
    if (salary > 0) {
      addRecurring({ type: 'income', name: 'Salário', amount: salary, categoryId: 'salary', dayOfMonth: salaryDay, active: true });
      syncRecurring();
    }
    updateSettings({
      name: name.trim(),
      reminderEnabled: reminder && result === 'ok',
      reminderHour: hour,
      reminderMinute: 0,
      onboarded: true,
    });
    setSaving(false);
    router.replace('/');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.white }}>
      <View style={[s.container, { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.lg }]}>
        <View style={s.dots}>
          {Array.from({ length: STEPS }).map((_, i) => (
            <View key={i} style={[s.dot, i <= step && { backgroundColor: colors.primary, width: i === step ? 24 : 8 }]} />
          ))}
        </View>

        {step === 0 && (
          <View style={s.body}>
            <View style={s.logo}>
              <Ionicons name="leaf" size={46} color={colors.white} />
            </View>
            <Text style={s.brand}>My Finance</Text>
            <Text style={s.headline}>Uma vida financeira saudável começa com um hábito simples.</Text>
            <Benefit icon="flash" text="Registre um gasto em segundos, do jeito que você fala: “almoço 32,50”." />
            <Benefit icon="flame" text="Crie sequência de dias cuidando do seu dinheiro." />
            <Benefit icon="pie-chart" text="Saiba todo dia quanto ainda pode gastar, já descontando contas e parcelas." />
            <Benefit icon="flag" text="Junte dinheiro para seus objetivos com metas." />
          </View>
        )}

        {step === 1 && (
          <View style={s.body}>
            <Text style={s.stepTitle}>Como podemos te chamar?</Text>
            <Text style={s.stepText}>É só para deixar o app com a sua cara.</Text>
            <TextInput
              testID="name-input"
              value={name}
              onChangeText={setName}
              placeholder="Seu nome"
              placeholderTextColor={colors.textMuted}
              autoFocus
              style={s.input}
              returnKeyType="next"
              onSubmitEditing={() => name.trim() && setStep(2)}
              maxLength={30}
            />
          </View>
        )}

        {step === 2 && (
          <View style={s.body}>
            <Text style={s.stepTitle}>Quanto você recebe por mês?</Text>
            <Text style={s.stepText}>
              Com a sua renda, o app calcula quanto você pode gastar por dia. Contas fixas como aluguel você adiciona depois.
            </Text>
            <View style={s.amountBox}>
              <AmountInput value={salary} onChange={setSalary} color={colors.primaryDark} testID="salary-input" />
            </View>
            <Text style={[s.stepText, { marginTop: space.lg, marginBottom: space.sm }]}>Cai em que dia?</Text>
            <View style={s.chips}>
              {SALARY_DAYS.map((d) => (
                <Chip key={d} label={`Dia ${d}`} selected={salaryDay === d} onPress={() => setSalaryDay(d)} />
              ))}
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={s.body}>
            <View style={[s.logo, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="notifications" size={40} color={colors.primary} />
            </View>
            <Text style={s.stepTitle}>Quer um lembrete diário?</Text>
            <Text style={s.stepText}>
              Hábitos se formam com constância. Um lembrete por dia, no horário que você escolher, para registrar seus gastos.
            </Text>
            <View style={s.chips}>
              {HOURS.map((h) => (
                <Chip key={h} label={`${h}h`} selected={hour === h} onPress={() => setHour(h)} />
              ))}
            </View>
          </View>
        )}

        <View style={{ gap: space.md }}>
          {step === 0 && <Button testID="start" label="Começar" onPress={() => setStep(1)} />}
          {step === 1 && <Button testID="next-name" label="Continuar" disabled={!name.trim()} onPress={() => setStep(2)} />}
          {step === 2 && (
            <>
              <Button testID="next-salary" label="Continuar" disabled={salary <= 0} onPress={() => setStep(3)} />
              <Button
                testID="skip-salary"
                label="Prefiro informar depois"
                variant="ghost"
                onPress={() => {
                  setSalary(0);
                  setStep(3);
                }}
              />
            </>
          )}
          {step === 3 && (
            <>
              <Button testID="enable-reminder" label="Ativar lembrete" icon="notifications" loading={saving} onPress={() => finish(true)} />
              <Button testID="skip-reminder" label="Agora não" variant="ghost" disabled={saving} onPress={() => finish(false)} />
            </>
          )}
          {step > 0 && (
            <Pressable onPress={() => setStep(step - 1)} style={{ alignSelf: 'center', padding: 6 }}>
              <Text style={{ color: colors.textSoft, fontWeight: '600' }}>Voltar</Text>
            </Pressable>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Benefit({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={s.benefit}>
      <View style={s.benefitIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={s.benefitText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: space.xl, justifyContent: 'space-between' },
  dots: { flexDirection: 'row', gap: 6, alignSelf: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  body: { flex: 1, justifyContent: 'center' },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: space.lg,
  },
  brand: { fontSize: 32, fontWeight: '900', color: colors.primaryDark, textAlign: 'center' },
  headline: { fontSize: 17, color: colors.textSoft, textAlign: 'center', marginTop: space.sm, marginBottom: space.xl, lineHeight: 24 },
  benefit: { flexDirection: 'row', alignItems: 'center', marginBottom: space.md },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  benefitText: { flex: 1, fontSize: 15, color: colors.text, lineHeight: 21 },
  stepTitle: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: space.sm, textAlign: 'center' },
  stepText: { fontSize: 15, color: colors.textSoft, lineHeight: 22, marginBottom: space.xl, textAlign: 'center' },
  input: {
    borderWidth: 2,
    borderColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    fontSize: 20,
    color: colors.text,
    textAlign: 'center',
  },
  amountBox: { backgroundColor: colors.primaryLight, borderRadius: radius.lg, paddingVertical: space.xl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
});
