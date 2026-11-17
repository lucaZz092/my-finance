import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../lib/theme';
import { useFinance } from '../../store/useFinance';

type IconName = keyof typeof Ionicons.glyphMap;

const tab = (title: string, icon: IconName, iconActive: IconName) => ({
  title,
  tabBarIcon: ({ focused, color }: { focused: boolean; color: ColorValue }) => (
    <Ionicons name={focused ? iconActive : icon} size={24} color={color as string} />
  ),
});

export default function TabsLayout() {
  const onboarded = useFinance((s) => s.settings.onboarded);
  const insets = useSafeAreaInsets();
  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', lineHeight: 15, paddingBottom: 2 },
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          height: 68 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 10,
        },
      }}
    >
      <Tabs.Screen name="index" options={tab('Hoje', 'today-outline', 'today')} />
      <Tabs.Screen name="extrato" options={tab('Extrato', 'list-outline', 'list')} />
      <Tabs.Screen name="orcamento" options={tab('Orçamento', 'pie-chart-outline', 'pie-chart')} />
      <Tabs.Screen name="metas" options={tab('Metas', 'flag-outline', 'flag')} />
      <Tabs.Screen name="ajustes" options={tab('Ajustes', 'settings-outline', 'settings')} />
    </Tabs>
  );
}
