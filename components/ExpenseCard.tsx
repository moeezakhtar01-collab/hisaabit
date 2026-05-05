import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeOut, SlideInRight } from 'react-native-reanimated';
import { useColors } from '@/lib/theme-context';
import { type ThemeColors } from '@/constants/colors';
import { Expense, getCategoryLabel, getCategoryIcon, formatPKR, formatDate } from '@/lib/storage';

interface ExpenseCardProps {
  expense: Expense;
  onDelete: (id: string) => void;
  onEdit?: (expense: Expense) => void;
  index: number;
}

export default function ExpenseCard({ expense, onDelete, onEdit, index }: ExpenseCardProps) {
  const colors = useColors();
  const styles = createStyles(colors);
  const categoryColor = colors.categories[expense.category as keyof typeof colors.categories] || colors.categories.general;

  return (
    <Animated.View
      entering={SlideInRight.delay(index * 40).duration(300)}
      exiting={FadeOut.duration(200)}
    >
      <Pressable
        style={({ pressed }) => [
          styles.card,
          pressed && styles.cardPressed,
        ]}
        onPress={() => onEdit?.(expense)}
        // Long-press still works for power users who don't want the
        // visible button (kept for backwards compatibility), but the
        // discoverable trash icon below is now the primary affordance.
        onLongPress={() => onDelete(expense.id)}
        delayLongPress={500}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${getCategoryLabel(expense.category)} expense, ${formatPKR(expense.amount)}`}
      >
        <View style={[styles.iconContainer, { backgroundColor: categoryColor + '15' }]}>
          <Ionicons
            name={getCategoryIcon(expense.category) as any}
            size={22}
            color={categoryColor}
          />
        </View>
        <View style={styles.details}>
          <Text style={styles.category} numberOfLines={1}>
            {getCategoryLabel(expense.category)}
          </Text>
          {expense.note ? (
            <Text style={styles.note} numberOfLines={1}>
              {expense.note}
            </Text>
          ) : null}
        </View>
        <View style={styles.amountContainer}>
          <Text style={styles.amount}>{formatPKR(expense.amount)}</Text>
          <Text style={styles.date}>{formatDate(expense.date)}</Text>
        </View>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onDelete(expense.id);
          }}
          hitSlop={10}
          style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.6 }]}
          accessibilityLabel="Delete expense"
          testID={`expense-delete-${expense.id}`}
        >
          <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: {
    flex: 1,
    marginLeft: 12,
    gap: 2,
  },
  category: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
  },
  note: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
  amountContainer: {
    alignItems: 'flex-end',
    gap: 2,
  },
  amount: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: colors.text,
  },
  date: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
  deleteBtn: {
    marginLeft: 8,
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});
