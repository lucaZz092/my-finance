import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router/stack';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { syncDailyReminder } from '../lib/reminders';
import { colors } from '../lib/theme';
import { useFinance, useHydrated } from '../store/useFinance';

export default function RootLayout() {
  const hydrated = useHydrated();
  const { reminderEnabled, reminderHour, reminderMinute } = useFinance((s) => s.settings);

  // Reagenda o lembrete ao abrir o app (garante que continua ativo após atualizações).
  useEffect(() => {
    if (hydrated && reminderEnabled) syncDailyReminder(true, reminderHour, reminderMinute);
  }, [hydrated, reminderEnabled, reminderHour, reminderMinute]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }}>
        <ActivityIndicator color={colors.white} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="transaction" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="goal" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="budget" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
