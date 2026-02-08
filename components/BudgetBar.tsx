import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { getCategoryLabel, getCategoryIcon, formatPKR } from '@/lib/storage';

interface BudgetBarProps {
  category: string;
  spent: number;
  limit: number;
  index: number;
}

export default function BudgetBar({ category, spent, limit, index }: BudgetBarProps) {
  const percentage = Math.min((spent / limit) * 100, 100);
  const isOverBudget = spent > limit;
  const color = Colors.categories[category as keyof typeof Colors.categories] || Colors.categories.general;
  const barColor = isOverBudget ? Colors.danger : color;

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
        <Text style={[styles.amountText, isOverBudget && styles.overBudgetText]}>
          {formatPKR(spent)} / {formatPKR(limit)}
        </Text>
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
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
    color: Colors.text,
  },
  amountText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  overBudgetText: {
    color: Colors.danger,
    fontFamily: 'Inter_600SemiBold',
  },
  barBackground: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  warningText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.danger,
    marginTop: 6,
  },
});
