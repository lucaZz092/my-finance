import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCategory } from '../lib/categories';
import { addMonths, monthLabel } from '../lib/dates';
import { formatBRL, nextAmountFromEdit } from '../lib/money';
import { colors, radius, shadow, space } from '../lib/theme';
import type { Cents, MonthKey, Transaction } from '../lib/types';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({
  children,
  scroll = true,
  padded = true,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const style = [padded && { padding: space.lg }, { paddingBottom: 120 }, contentStyle];
  if (!scroll) return <View style={[styles.screen, { paddingTop: insets.top }, ...style]}>{children}</View>;
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[{ paddingTop: insets.top + (padded ? space.sm : 0) }, ...style]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {action}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const v = buttonVariants[variant];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: v.bg, borderColor: v.border },
        (disabled || loading) && { opacity: 0.45 },
        pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={20} color={v.fg} style={{ marginRight: 8 }} />}
          <Text style={[styles.buttonText, { color: v.fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const buttonVariants = {
  primary: { bg: colors.primary, fg: colors.white, border: colors.primary },
  secondary: { bg: colors.primaryLight, fg: colors.primaryDark, border: colors.primaryLight },
  ghost: { bg: 'transparent', fg: colors.primaryDark, border: colors.border },
  danger: { bg: colors.expenseLight, fg: colors.expense, border: colors.expenseLight },
};

export function ProgressBar({ value, color = colors.primary, height = 8 }: { value: number; color?: string; height?: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View style={[styles.track, { height, borderRadius: height }]}>
      <View style={{ width: `${pct}%`, height, borderRadius: height, backgroundColor: color }} />
    </View>
  );
}

export function IconBubble({ icon, color, size = 40 }: { icon: string; color: string; size?: number }) {
  return (
    <View style={[styles.bubble, { width: size, height: size, borderRadius: size / 2.6, backgroundColor: `${color}22` }]}>
      <Ionicons name={icon as IconName} size={size * 0.5} color={color} />
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  color = colors.primary,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: string;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        selected ? { backgroundColor: color, borderColor: color } : { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {icon && <Ionicons name={icon as IconName} size={16} color={selected ? colors.white : color} style={{ marginRight: 6 }} />}
      <Text style={[styles.chipText, { color: selected ? colors.white : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function MonthSwitcher({ month, onChange, maxMonth }: { month: MonthKey; onChange: (m: MonthKey) => void; maxMonth?: MonthKey }) {
  const canNext = !maxMonth || month < maxMonth;
  return (
    <View style={styles.monthRow}>
      <Pressable hitSlop={12} onPress={() => onChange(addMonths(month, -1))} style={styles.monthBtn} accessibilityLabel="Mês anterior">
        <Ionicons name="chevron-back" size={22} color={colors.primaryDark} />
      </Pressable>
      <Text style={styles.monthText}>{monthLabel(month)}</Text>
      <Pressable
        hitSlop={12}
        disabled={!canNext}
        onPress={() => onChange(addMonths(month, 1))}
        style={[styles.monthBtn, !canNext && { opacity: 0.3 }]}
        accessibilityLabel="Próximo mês"
      >
        <Ionicons name="chevron-forward" size={22} color={colors.primaryDark} />
      </Pressable>
    </View>
  );
}

export function TransactionRow({ tx, onPress }: { tx: Transaction; onPress?: () => void }) {
  const cat = getCategory(tx.categoryId);
  const isIncome = tx.type === 'income';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.txRow, pressed && { backgroundColor: colors.primaryLight }]}>
      <IconBubble icon={cat.icon} color={cat.color} />
      <View style={{ flex: 1, marginLeft: space.md }}>
        <Text style={styles.txTitle} numberOfLines={1}>
          {tx.note || cat.name}
        </Text>
        <Text style={styles.txSub}>{cat.name}</Text>
      </View>
      <Text style={[styles.txAmount, { color: isIncome ? colors.income : colors.text }]}>
        {isIncome ? '+' : '-'} {formatBRL(tx.amount)}
      </Text>
    </Pressable>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={34} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
      {action}
    </View>
  );
}

/** Campo de valor estilo app de banco: digita 4590 e aparece R$ 45,90. */
export function AmountInput({
  value,
  onChange,
  color = colors.text,
  autoFocus,
  size = 'lg',
  testID,
}: {
  value: Cents;
  onChange: (v: Cents) => void;
  color?: string;
  autoFocus?: boolean;
  size?: 'lg' | 'md';
  testID?: string;
}) {
  const fontSize = size === 'lg' ? 40 : 26;
  const text = formatBRL(value, { hideSymbol: true });
  return (
    <View style={styles.amountWrap}>
      <Text style={[styles.amountPrefix, { color, fontSize: fontSize * 0.55 }]}>R$</Text>
      <TextInput
        testID={testID}
        value={text}
        onChangeText={(t) => onChange(nextAmountFromEdit(value, text, t))}
        keyboardType="number-pad"
        autoFocus={autoFocus}
        selectTextOnFocus={false}
        style={[styles.amountInput, { color, fontSize }]}
        selectionColor={colors.primary}
        maxLength={18}
      />
    </View>
  );
}

export function Field({
  label,
  ...props
}: { label: string } & ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginBottom: space.lg }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput placeholderTextColor={colors.textMuted} selectionColor={colors.primary} {...props} style={[styles.field, props.style]} />
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, marginBottom: space.lg, ...shadow },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: space.lg },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md, marginTop: space.sm },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: space.xl,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
  track: { backgroundColor: colors.border, overflow: 'hidden', width: '100%' },
  bubble: { alignItems: 'center', justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginRight: space.sm,
    marginBottom: space.sm,
  },
  chipText: { fontSize: 14, fontWeight: '600' },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg },
  monthBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  monthText: { fontSize: 17, fontWeight: '700', color: colors.text },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderRadius: radius.sm },
  txTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  txSub: { fontSize: 13, color: colors.textSoft, marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '700', marginLeft: space.sm },
  empty: { alignItems: 'center', paddingVertical: space.xxl, paddingHorizontal: space.xl },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.lg,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 6, textAlign: 'center' },
  emptyText: { fontSize: 14, color: colors.textSoft, textAlign: 'center', lineHeight: 20, marginBottom: space.lg },
  amountWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  amountPrefix: { fontWeight: '700', marginRight: 6 },
  amountInput: { fontWeight: '800', minWidth: 120, textAlign: 'center', padding: 0 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.textSoft, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  field: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: 13,
    fontSize: 16,
    color: colors.text,
  },
});
