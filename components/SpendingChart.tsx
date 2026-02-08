import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { Expense, getCategoryLabel, getCategoryIcon, formatPKR } from '@/lib/storage';

interface SpendingChartProps {
  expenses: Expense[];
}

interface CategoryBreakdown {
  category: string;
  total: number;
  percentage: number;
}

export default function SpendingChart({ expenses }: SpendingChartProps) {
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);

  if (totalSpent === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="pie-chart-outline" size={48} color={Colors.textSecondary} />
        <Text style={styles.emptyText}>No expenses this month</Text>
        <Text style={styles.emptySubText}>Add your first expense to see insights</Text>
      </View>
    );
  }

  const categoryMap = new Map<string, number>();
  expenses.forEach(e => {
    const current = categoryMap.get(e.category) || 0;
    categoryMap.set(e.category, current + e.amount);
  });

  const breakdowns: CategoryBreakdown[] = Array.from(categoryMap.entries())
    .map(([category, total]) => ({
      category,
      total,
      percentage: (total / totalSpent) * 100,
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <Animated.View entering={FadeIn.duration(500)} style={styles.container}>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total Spent</Text>
        <Text style={styles.totalAmount}>{formatPKR(totalSpent)}</Text>
      </View>

      <View style={styles.barContainer}>
        {breakdowns.map((item, i) => {
          const color = Colors.categories[item.category as keyof typeof Colors.categories] || Colors.categories.general;
          return (
            <View
              key={item.category}
              style={[
                styles.barSegment,
                {
                  flex: item.percentage,
                  backgroundColor: color,
                  borderTopLeftRadius: i === 0 ? 6 : 0,
                  borderBottomLeftRadius: i === 0 ? 6 : 0,
                  borderTopRightRadius: i === breakdowns.length - 1 ? 6 : 0,
                  borderBottomRightRadius: i === breakdowns.length - 1 ? 6 : 0,
                },
              ]}
            />
          );
        })}
      </View>

      <View style={styles.legendContainer}>
        {breakdowns.slice(0, 6).map((item) => {
          const color = Colors.categories[item.category as keyof typeof Colors.categories] || Colors.categories.general;
          return (
            <View key={item.category} style={styles.legendItem}>
              <View style={styles.legendLeft}>
                <View style={[styles.legendDot, { backgroundColor: color }]} />
                <Ionicons name={getCategoryIcon(item.category) as any} size={14} color={color} />
                <Text style={styles.legendLabel}>{getCategoryLabel(item.category)}</Text>
              </View>
              <View style={styles.legendRight}>
                <Text style={styles.legendAmount}>{formatPKR(item.total)}</Text>
                <Text style={styles.legendPercent}>{Math.round(item.percentage)}%</Text>
              </View>
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyContainer: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 32,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  emptySubText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  totalAmount: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  barContainer: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    gap: 2,
    marginBottom: 16,
  },
  barSegment: {
    height: '100%',
  },
  legendContainer: {
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.text,
  },
  legendRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendAmount: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  legendPercent: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    width: 32,
    textAlign: 'right',
  },
});
