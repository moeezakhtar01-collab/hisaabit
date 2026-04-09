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
import { router, useLocalSearchParams } from 'expo-router';
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

export default function PeriodExpensesScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = createStyles(colors);
  const { period } = useLocalSearchParams<{ period: string }>();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const isDaily = period === 'today';
  const weekRange = getWeekDateRange();

  const loadExpenses = useCallback(async () => {
    const all = await getExpenses();
    setExpenses(all);
  }, []);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadExpenses();
    setRefreshing(false);
  }, [loadExpenses]);

  const filteredExpenses = isDaily
    ? getExpensesForToday(expenses)
    : getExpensesForWeek(expenses);

  const total = getTotalExpenses(filteredExpenses);
  const title = isDaily ? "Today's Expenses" : "This Week's Expenses";
  const subtitle = isDaily
    ? new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    : weekRange.label;

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

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

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
        <View style={[styles.totalIconBg, { backgroundColor: isDaily ? colors.accent + '20' : colors.primary + '15' }]}>
          <Ionicons
            name={isDaily ? 'today' : 'calendar'}
            size={20}
            color={isDaily ? colors.accent : colors.primary}
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
          { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={40} color={colors.textSecondary} />
            <Text style={styles.emptyText}>
              {isDaily ? 'No expenses today' : 'No expenses this week'}
            </Text>
            <Text style={styles.emptySubText}>
              {isDaily ? "You haven't logged anything today yet" : "You haven't logged anything this week yet"}
            </Text>
          </View>
        }
      />
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
});
