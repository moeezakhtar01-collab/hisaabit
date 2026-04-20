import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Platform,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useColors } from '@/lib/theme-context';
import type { lightColors } from '@/constants/colors';
import ExpenseCard from '@/components/ExpenseCard';
import {
  Expense,
  getExpenses,
  deleteExpense,
  getExpensesForToday,
  getExpensesForWeek,
  getWeekDateRange,
  getTotalExpenses,
  formatPKR,
} from '@/lib/storage';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseDayKey(dayKey: string): Date {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayDiffInDays(target: Date, reference: Date): number {
  const a = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const b = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

export default function PeriodExpensesScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = createStyles(colors);
  const { period, date: dateParam } = useLocalSearchParams<{ period: string; date?: string }>();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const isDaily = period === 'today';
  const isDayView = period === 'day' && !!dateParam;
  const isSingleDay = isDaily || isDayView;
  const targetDate = isDayView ? parseDayKey(dateParam) : new Date();
  const weekRange = getWeekDateRange();

  const loadExpenses = useCallback(async () => {
    const all = await getExpenses();
    setExpenses(all);
  }, []);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  // Reload whenever the screen regains focus (e.g., returning from add-expense
  // after logging a new entry for this day).
  useFocusEffect(
    useCallback(() => {
      loadExpenses();
    }, [loadExpenses])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadExpenses();
    setRefreshing(false);
  }, [loadExpenses]);

  const filteredExpenses = isDaily
    ? getExpensesForToday(expenses)
    : isDayView
      ? expenses.filter(e => {
          const dateOnly = e.date.includes('T') ? e.date.split('T')[0] : e.date;
          return dateOnly === dateParam;
        })
      : getExpensesForWeek(expenses);

  const total = getTotalExpenses(filteredExpenses);

  // Title / subtitle logic
  const today = new Date();
  const isToday = isDaily || (isDayView && isSameDay(targetDate, today));

  let title: string;
  let subtitle: string;
  let headerIconName: keyof typeof Ionicons.glyphMap;

  if (isDayView) {
    const diff = dayDiffInDays(targetDate, today);
    const weekday = WEEKDAYS_FULL[targetDate.getDay()];
    const dateLabel = `${weekday}, ${targetDate.getDate()} ${MONTHS_SHORT[targetDate.getMonth()]} ${targetDate.getFullYear()}`;

    if (diff === 0) {
      title = "Today's Expenses";
      subtitle = dateLabel;
      headerIconName = 'today';
    } else if (diff === -1) {
      title = "Yesterday's Expenses";
      subtitle = dateLabel;
      headerIconName = 'calendar-outline';
    } else if (diff > 0) {
      // Future — shouldn't happen via the UI, but be defensive
      title = `${weekday}'s Expenses`;
      subtitle = dateLabel;
      headerIconName = 'calendar-outline';
    } else {
      title = `${weekday}'s Expenses`;
      subtitle = dateLabel;
      headerIconName = 'calendar-outline';
    }
  } else if (isDaily) {
    title = "Today's Expenses";
    subtitle = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    headerIconName = 'today';
  } else {
    title = "This Week's Expenses";
    subtitle = weekRange.label;
    headerIconName = 'calendar';
  }

  const handleEdit = (expense: Expense) => {
    router.push({
      pathname: '/add-expense',
      params: {
        editId: expense.id,
        editAmount: expense.amount.toString(),
        editCategory: expense.category,
        editNote: expense.note || '',
        editDate: expense.date,
      },
    });
  };

  const handleDelete = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to remove this expense?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteExpense(id);
            await loadExpenses();
          },
        },
      ]
    );
  };

  // Pre-fill date for add / voice. For isDaily we omit the param so add-expense
  // defaults to now (current time). For isDayView we pass the explicit date.
  const addPathParams = isDayView ? { date: dateParam as string } : {};

  const handleAddExpense = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/add-expense', params: addPathParams });
  };

  const handleAddVoice = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/voice-expense', params: addPathParams });
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const ctaBottomPad = Platform.OS === 'web' ? 20 : Math.max(insets.bottom, 12);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.headerSubtitle}>{subtitle}</Text>
        </View>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.totalCard}>
        <View style={[styles.totalIconBg, { backgroundColor: isToday ? colors.accent + '20' : colors.primary + '15' }]}>
          <Ionicons
            name={headerIconName}
            size={20}
            color={isToday ? colors.accent : colors.primary}
          />
        </View>
        <View>
          <Text style={styles.totalLabel}>Total Spent</Text>
          <Text style={styles.totalAmount}>{formatPKR(total)}</Text>
        </View>
        <View style={styles.totalCountBadge}>
          <Text style={styles.totalCountText}>
            {filteredExpenses.length} {filteredExpenses.length === 1 ? 'expense' : 'expenses'}
          </Text>
        </View>
      </View>

      <FlatList
        data={filteredExpenses}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <ExpenseCard
            expense={item}
            onDelete={handleDelete}
            onEdit={handleEdit}
            index={index}
          />
        )}
        contentContainerStyle={[
          styles.listContent,
          // Reserve room for the sticky CTA bar when it's visible
          { paddingBottom: isSingleDay ? 96 : (Platform.OS === 'web' ? 34 : insets.bottom + 20) },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={40} color={colors.textSecondary} />
            <Text style={styles.emptyText}>
              {isDayView
                ? `No expenses for ${WEEKDAYS_FULL[targetDate.getDay()]}`
                : isDaily
                  ? 'No expenses today'
                  : 'No expenses this week'}
            </Text>
            <Text style={styles.emptySubText}>
              {isSingleDay ? 'Tap below to log one' : "You haven't logged anything this week yet"}
            </Text>
          </View>
        }
      />

      {/* Sticky CTA bar — only for single-day views */}
      {isSingleDay && (
        <View style={[styles.ctaBar, { paddingBottom: ctaBottomPad }]}>
          <Pressable
            onPress={handleAddExpense}
            style={({ pressed }) => [styles.ctaPrimary, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
            testID="day-add-expense-button"
          >
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.ctaPrimaryText}>
              {filteredExpenses.length > 0 ? 'Add another expense' : 'Add expense'}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleAddVoice}
            style={({ pressed }) => [styles.ctaSecondary, pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] }]}
            testID="day-add-voice-button"
          >
            <Ionicons name="mic" size={22} color={colors.primary} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: typeof lightColors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
    marginTop: 2,
  },
  totalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  totalIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
  },
  totalAmount: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: colors.text,
  },
  totalCountBadge: {
    marginLeft: 'auto',
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  totalCountText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textSecondary,
  },
  listContent: {
    paddingHorizontal: 0,
    paddingTop: 8,
  },
  emptyContainer: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 32,
    marginHorizontal: 16,
    marginTop: 16,
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
    textAlign: 'center',
  },
  ctaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ctaPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  ctaPrimaryText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  ctaSecondary: {
    width: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.primary + '12',
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
});
