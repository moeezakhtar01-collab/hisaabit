import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedProps,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/lib/theme-context';
import { type ThemeColors } from '@/constants/colors';
import { Expense, getCategoryLabel, formatPKR } from '@/lib/storage';
import AnimatedAmount from './AnimatedAmount';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const OTHER_COLOR = '#6B7280';

interface SpendingChartProps {
  expenses: Expense[];
  periodLabel?: string;
}

interface CategoryBreakdown {
  category: string;
  total: number;
  percentage: number;
}

const PIE_SIZE = 180;
const PIE_RADIUS = 70;
const PIE_CENTER = PIE_SIZE / 2;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const sweep = endAngle - startAngle;
  if (sweep >= 359.99) {
    const mid = startAngle + 180;
    const s = polarToCartesian(cx, cy, r, startAngle);
    const m = polarToCartesian(cx, cy, r, mid);
    return `M ${s.x} ${s.y} A ${r} ${r} 0 1 1 ${m.x} ${m.y} A ${r} ${r} 0 1 1 ${s.x} ${s.y} Z`;
  }
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

function AnimatedSlice({ d, color, index, dimmed }: { d: string; color: string; index: number; dimmed: boolean }) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      index * 150,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) }),
    );
  }, []);

  const targetOpacity = dimmed ? 0.25 : 1;

  const animatedProps = useAnimatedProps(() => ({
    opacity: Math.min(opacity.value, targetOpacity),
  }));

  return <AnimatedPath d={d} fill={color} animatedProps={animatedProps} />;
}

function getCategoryDisplayName(category: string): string {
  return category === 'other' ? 'Other' : getCategoryLabel(category);
}

function getSliceColor(category: string, colors: ThemeColors): string {
  if (category === 'other') return OTHER_COLOR;
  return colors.categories[category as keyof typeof colors.categories] || colors.categories.general;
}

export default function SpendingChart({ expenses, periodLabel }: SpendingChartProps) {
  const colors = useColors();
  const styles = createStyles(colors);
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const [selected, setSelected] = useState<string | null>(null);
  const [otherExpanded, setOtherExpanded] = useState(false);

  if (totalSpent === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="pie-chart-outline" size={48} color={colors.textSecondary} />
        <Text style={styles.emptyText}>No expenses {periodLabel ? `this ${periodLabel.toLowerCase()}` : 'yet'}</Text>
        <Text style={styles.emptySubText}>Add your first expense to see insights</Text>
      </View>
    );
  }

  const categoryMap = new Map<string, number>();
  expenses.forEach(e => {
    const current = categoryMap.get(e.category) || 0;
    categoryMap.set(e.category, current + e.amount);
  });

  const MAX_CATEGORIES = 6;
  const allBreakdowns: CategoryBreakdown[] = Array.from(categoryMap.entries())
    .map(([category, total]) => ({
      category,
      total,
      percentage: (total / totalSpent) * 100,
    }))
    .sort((a, b) => b.total - a.total);

  // Group 7th+ categories into "Other"
  let breakdowns: CategoryBreakdown[];
  let otherBreakdowns: CategoryBreakdown[] = [];
  if (allBreakdowns.length > MAX_CATEGORIES) {
    const top = allBreakdowns.slice(0, MAX_CATEGORIES - 1);
    const rest = allBreakdowns.slice(MAX_CATEGORIES - 1);
    otherBreakdowns = rest;
    const otherTotal = rest.reduce((s, b) => s + b.total, 0);
    breakdowns = [
      ...top,
      { category: 'other', total: otherTotal, percentage: (otherTotal / totalSpent) * 100 },
    ];
  } else {
    breakdowns = allBreakdowns;
  }

  // Build pie slices
  let currentAngle = 0;
  const slices = breakdowns.map((item) => {
    const sweep = (item.percentage / 100) * 360;
    const d = describeArc(PIE_CENTER, PIE_CENTER, PIE_RADIUS, currentAngle, currentAngle + sweep);
    currentAngle += sweep;
    return { d, category: item.category };
  });

  const selectedBreakdown = selected ? breakdowns.find(b => b.category === selected) : null;
  const displayLabel = selectedBreakdown ? getCategoryDisplayName(selected!) : 'Total Spent';
  const displayAmount = selectedBreakdown ? selectedBreakdown.total : totalSpent;
  const isOtherSelected = selected === 'other';

  const handleLegendTap = (category: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (category === selected) {
      setSelected(null);
      setOtherExpanded(false);
    } else {
      setSelected(category);
      setOtherExpanded(false);
    }
  };

  const handleOtherExpand = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOtherExpanded(prev => !prev);
  };

  return (
    <View style={styles.container}>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>{displayLabel}</Text>
        <View style={styles.amountRow}>
          <AnimatedAmount value={displayAmount} formatter={formatPKR} style={styles.totalAmount} />
          {isOtherSelected && otherBreakdowns.length > 0 && (
            <Pressable onPress={handleOtherExpand} hitSlop={8}>
              <Ionicons
                name={otherExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textSecondary}
              />
            </Pressable>
          )}
        </View>
      </View>

      {isOtherSelected && otherExpanded && otherBreakdowns.length > 0 && (
        <View style={styles.otherDetailList}>
          {otherBreakdowns.map((item) => {
            const color = getSliceColor(item.category, colors);
            return (
              <View key={item.category} style={styles.otherDetailItem}>
                <View style={styles.otherDetailLeft}>
                  <View style={[styles.legendDot, { backgroundColor: color }]} />
                  <Text style={styles.otherDetailLabel}>{getCategoryDisplayName(item.category)}</Text>
                </View>
                <Text style={styles.otherDetailAmount}>{formatPKR(item.total)}</Text>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.pieContainer}>
        <Svg width={PIE_SIZE} height={PIE_SIZE}>
          {slices.map((slice, i) => {
            const color = getSliceColor(slice.category, colors);
            const dimmed = selected !== null && slice.category !== selected;
            return <AnimatedSlice key={slice.category} d={slice.d} color={color} index={i} dimmed={dimmed} />;
          })}
        </Svg>
      </View>

      <View style={styles.legendContainer}>
        {breakdowns.map((item) => {
          const color = getSliceColor(item.category, colors);
          const isSelected = selected === item.category;
          return (
            <Pressable
              key={item.category}
              onPress={() => handleLegendTap(item.category)}
              style={[
                styles.legendItem,
                isSelected && { backgroundColor: color + '20', borderColor: color, borderWidth: 1 },
              ]}
            >
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <Text style={styles.legendLabel} numberOfLines={1}>{getCategoryDisplayName(item.category)}</Text>
              <Text style={styles.legendPercent}>{Math.round(item.percentage)}%</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyContainer: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 32,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
  },
  emptySubText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  totalAmount: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: colors.text,
  },
  pieContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  otherDetailList: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  otherDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  otherDetailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  otherDetailLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: colors.text,
  },
  otherDetailAmount: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
    rowGap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: colors.text,
  },
  legendPercent: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textSecondary,
  },
});
