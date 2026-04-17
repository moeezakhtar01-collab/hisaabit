import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
        onLongPress={() => onDelete(expense.id)}
        delayLongPress={500}
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
});
