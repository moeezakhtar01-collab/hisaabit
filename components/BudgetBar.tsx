import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/lib/theme-context';
import { type ThemeColors } from '@/constants/colors';
import { getCategoryLabel, getCategoryIcon, formatPKR } from '@/lib/storage';

interface BudgetBarProps {
  category: string;
  spent: number;
  limit: number;
  index: number;
  onDelete?: () => void;
}

export default function BudgetBar({ category, spent, limit, index, onDelete }: BudgetBarProps) {
  const colors = useColors();
  const styles = createStyles(colors);
  const percentage = Math.min((spent / limit) * 100, 100);
  const isOverBudget = spent > limit;
  const color = colors.categories[category as keyof typeof colors.categories] || colors.categories.general;
  const barColor = isOverBudget ? colors.danger : color;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(400)}
      style={styles.container}
    >
      <View style={styles.header}>
        <View style={styles.categoryRow}>
          <View style={[styles.iconDot, { backgroundColor: color + '20' }]}>
            <Ionicons name={getCategoryIcon(category) as any} size={16} color={color} />
          </View>
          <Text style={styles.categoryLabel}>{getCategoryLabel(category)}</Text>
        </View>
        <View style={styles.rightRow}>
          <Text style={[styles.amountText, isOverBudget && styles.overBudgetText]}>
            {formatPKR(spent)} / {formatPKR(limit)}
          </Text>
          {onDelete ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onDelete();
              }}
              hitSlop={10}
              style={({ pressed }) => [styles.deleteIconBtn, pressed && { opacity: 0.6 }]}
              accessibilityLabel="Delete budget"
              testID={`budget-delete-${category}`}
            >
              <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
            </Pressable>
          ) : (
            <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
          )}
        </View>
      </View>
      <View style={styles.barBackground}>
        <View
          style={[
            styles.barFill,
            {
              width: `${percentage}%` as any,
              backgroundColor: barColor,
            },
          ]}
        />
      </View>
      {isOverBudget ? (
        <Text style={styles.warningText}>
          {formatPKR(spent - limit)} over budget
        </Text>
      ) : null}
    </Animated.View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconDot: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deleteIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  amountText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
  },
  overBudgetText: {
    color: colors.danger,
    fontFamily: 'Inter_600SemiBold',
  },
  barBackground: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  warningText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: colors.danger,
    marginTop: 6,
  },
});
