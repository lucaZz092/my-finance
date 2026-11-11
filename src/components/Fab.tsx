import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import { colors, shadow } from '../lib/theme';

export function Fab({ onPress, testID, label }: { onPress: () => void; testID?: string; label: string }) {
  return (
    <Pressable testID={testID} accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [s.fab, pressed && { transform: [{ scale: 0.94 }] }]}>
      <Ionicons name="add" size={30} color={colors.white} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
    shadowOpacity: 0.25,
    elevation: 6,
  },
});
