import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeOut, SlideInRight } from 'react-native-reanimated';
import { useColors } from '@/lib/theme-context';
import { type ThemeColors } from '@/constants/colors';
import { getCategoryLabel, getCategoryIcon, formatPKR, formatDate } from '@/lib/storage';
import type { PendingExpense } from '@/lib/sms-storage';

interface PendingExpenseCardProps {
  expense: PendingExpense;
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
  onEdit: (expense: PendingExpense) => void;
  index: number;
}

export default function PendingExpenseCard({ expense, onConfirm, onDismiss, onEdit, index }: PendingExpenseCardProps) {
  const colors = useColors();
  const styles = createStyles(colors);
  const categoryColor = colors.categories[expense.category as keyof typeof colors.categories] || colors.categories.general;

  return (
    <Animated.View
      entering={SlideInRight.delay(index * 50).duration(300)}
      exiting={FadeOut.duration(200)}
    >
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => onEdit(expense)}
      >
        {/* Pending badge */}
        <View style={styles.pendingBadge}>
          <Ionicons name="mail-unread-outline" size={10} color={colors.warning} />
          <Text style={styles.pendingBadgeText}>
            {expense.smsSender || 'SMS'}
          </Text>
        </View>

        <View style={styles.mainRow}>
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
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.dismissBtn, pressed && { opacity: 0.7 }]}
            onPress={() => onDismiss(expense.id)}
          >
            <Ionicons name="close" size={16} color={colors.danger} />
            <Text style={[styles.actionText, { color: colors.danger }]}>Dismiss</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.editBtn, pressed && { opacity: 0.7 }]}
            onPress={() => onEdit(expense)}
          >
            <Ionicons name="create-outline" size={16} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>Edit</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.confirmBtn, pressed && { opacity: 0.7 }]}
            onPress={() => onConfirm(expense.id)}
          >
            <Ionicons name="checkmark" size={16} color={colors.success} />
            <Text style={[styles.actionText, { color: colors.success }]}>Confirm</Text>
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.warning + '40',
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.85,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 2,
  },
  pendingBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: colors.warning,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
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
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 4,
  },
  dismissBtn: {
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  editBtn: {
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  confirmBtn: {},
  actionText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
});
