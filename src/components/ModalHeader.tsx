import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space } from '../lib/theme';

export function closeModal() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export function ModalHeader({ title, onDelete }: { title: string; onDelete?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.header, { paddingTop: insets.top + space.sm }]}>
      <Pressable testID="close-modal" hitSlop={10} onPress={closeModal} style={s.btn} accessibilityLabel="Fechar">
        <Ionicons name="close" size={24} color={colors.text} />
      </Pressable>
      <Text style={s.title}>{title}</Text>
      {onDelete ? (
        <Pressable testID="delete" hitSlop={10} onPress={onDelete} style={s.btn} accessibilityLabel="Excluir">
          <Ionicons name="trash-outline" size={22} color={colors.expense} />
        </Pressable>
      ) : (
        <View style={s.btn} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    backgroundColor: colors.bg,
  },
  btn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
});
