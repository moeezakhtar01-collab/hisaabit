import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import Colors from '@/constants/colors';
import SpendingChart from '@/components/SpendingChart';
import ExpenseCard from '@/components/ExpenseCard';
import {
  Expense,
  MonthlyBudget,
  BudgetSettings,
  getExpenses,
  deleteExpense,
  getExpensesForMonth,
  getExpensesForWeek,
  getExpensesForToday,
  getWeekDateRange,
  getMonthKey,
  getMonthLabel,
  getMonthlyBudget,
  getBudgetSettingsApi,
  formatPKR,
  getTotalExpenses,
} from '@/lib/storage';


export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [monthlyBudget, setMonthlyBudgetState] = useState<MonthlyBudget | null>(null);
  const [budgetSettings, setBudgetSettingsState] = useState<BudgetSettings | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const currentMonth = getMonthKey();

  const loadExpenses = useCallback(async () => {
    const [all, mb, bs] = await Promise.all([getExpenses(), getMonthlyBudget(currentMonth), getBudgetSettingsApi()]);
    setExpenses(all);
    setMonthlyBudgetState(mb);
    setBudgetSettingsState(bs);
  }, [currentMonth]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  useEffect(() => {
    const interval = setInterval(loadExpenses, 2000);
    return () => clearInterval(interval);
  }, [loadExpenses]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadExpenses();
    setRefreshing(false);
  }, [loadExpenses]);

  const monthExpenses = getExpensesForMonth(expenses, currentMonth);
  const totalThisMonth = getTotalExpenses(monthExpenses);
  const recentExpenses = monthExpenses.slice(0, 5);

  const weekExpenses = getExpensesForWeek(expenses);
  const weekTotal = getTotalExpenses(weekExpenses);
  const weekRange = getWeekDateRange();
  const weeklyLimit = budgetSettings?.weeklyLimit ?? 0;

  const todayExpenses = getExpensesForToday(expenses);
  const todayTotal = getTotalExpenses(todayExpenses);
  const dailyLimit = budgetSettings?.dailyLimit ?? 0;

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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Platform.OS === 'web' ? 34 : 120 },
        ]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 12 }]}>
          <Text style={styles.monthLabel}>{getMonthLabel(currentMonth)}</Text>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/voice-expense');
              }}
              style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.8, transform: [{ scale: 0.92 }] }]}
              testID="add-voice"
              accessibilityLabel="Record voice expense"
            >
              <Ionicons name="mic" size={22} color="#fff" />
              <View style={styles.plusBadge}>
                <Ionicons name="add" size={10} color="#fff" />
              </View>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/add-expense');
              }}
              style={({ pressed }) => [styles.headerBtn, styles.headerBtnAccent, pressed && { opacity: 0.8, transform: [{ scale: 0.92 }] }]}
              testID="add-manual"
              accessibilityLabel="Type expense manually"
            >
              <Ionicons name="create" size={20} color="#fff" />
              <View style={styles.plusBadge}>
                <Ionicons name="add" size={10} color="#fff" />
              </View>
            </Pressable>
          </View>
        </View>

        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryIconBg, { backgroundColor: Colors.primary + '15' }]}>
              <Ionicons name="calendar" size={18} color={Colors.primary} />
            </View>
            <Text style={styles.summaryLabel}>Spent This Month</Text>
            <Text style={styles.summaryAmount}>{formatPKR(totalThisMonth)}</Text>
          </View>
          {monthlyBudget && monthlyBudget.totalLimit > 0 ? (
            <View style={styles.summaryCard}>
              <View style={[styles.summaryIconBg, {
                backgroundColor: (monthlyBudget.totalLimit - totalThisMonth >= 0 ? Colors.success : Colors.danger) + '15'
              }]}>
                <Ionicons
                  name="wallet"
                  size={18}
                  color={monthlyBudget.totalLimit - totalThisMonth >= 0 ? Colors.success : Colors.danger}
                />
              </View>
              <Text style={styles.summaryLabel}>
                {monthlyBudget.totalLimit - totalThisMonth >= 0 ? 'Remaining' : 'Over Budget'}
              </Text>
              <Text style={[
                styles.summaryAmount,
                { color: monthlyBudget.totalLimit - totalThisMonth >= 0 ? Colors.success : Colors.danger }
              ]}>
                {formatPKR(Math.abs(monthlyBudget.totalLimit - totalThisMonth))}
              </Text>
            </View>
          ) : (
            <View style={styles.summaryCard}>
              <View style={[styles.summaryIconBg, { backgroundColor: Colors.accent + '20' }]}>
                <Ionicons name="today" size={18} color={Colors.accent} />
              </View>
              <Text style={styles.summaryLabel}>Today</Text>
              <Text style={styles.summaryAmount}>{formatPKR(todayTotal)}</Text>
            </View>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(500)}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({ pathname: '/period-expenses', params: { period: 'week' } });
            }}
            style={({ pressed }) => [pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
          >
            <View style={styles.periodCard}>
              <View style={styles.periodHeader}>
                <View style={[styles.periodIconBg, { backgroundColor: Colors.primary + '15' }]}>
                  <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
                </View>
                <View style={styles.periodTitleArea}>
                  <Text style={styles.periodTitle}>This Week</Text>
                  <Text style={styles.periodSubtitle}>{weekRange.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
              </View>
              <View style={styles.periodAmounts}>
                <View style={styles.periodAmountItem}>
                  <Text style={styles.periodAmountLabel}>Spent</Text>
                  <Text style={[
                    styles.periodAmountValue,
                    weeklyLimit > 0 && weekTotal > weeklyLimit && { color: Colors.danger },
                  ]}>{formatPKR(weekTotal)}</Text>
                </View>
                {weeklyLimit > 0 ? (
                  <>
                    <View style={styles.periodDivider} />
                    <View style={styles.periodAmountItem}>
                      <Text style={styles.periodAmountLabel}>Budget</Text>
                      <Text style={styles.periodAmountValue}>{formatPKR(weeklyLimit)}</Text>
                    </View>
                    <View style={styles.periodDivider} />
                    <View style={styles.periodAmountItem}>
                      <Text style={styles.periodAmountLabel}>
                        {weeklyLimit - weekTotal >= 0 ? 'Left' : 'Over'}
                      </Text>
                      <Text style={[
                        styles.periodAmountValue,
                        { color: weeklyLimit - weekTotal >= 0 ? Colors.success : Colors.danger },
                      ]}>{formatPKR(Math.abs(weeklyLimit - weekTotal))}</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.periodDivider} />
                    <View style={styles.periodAmountItem}>
                      <Text style={styles.periodAmountLabel}>Expenses</Text>
                      <Text style={styles.periodAmountValue}>{weekExpenses.length}</Text>
                    </View>
                  </>
                )}
              </View>
              {weeklyLimit > 0 ? (
                <View style={styles.periodBarBg}>
                  <View
                    style={[
                      styles.periodBarFill,
                      {
                        width: `${Math.min((weekTotal / weeklyLimit) * 100, 100)}%` as any,
                        backgroundColor: weekTotal > weeklyLimit ? Colors.danger : Colors.primary,
                      },
                    ]}
                  />
                </View>
              ) : null}
            </View>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(180).duration(500)}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({ pathname: '/period-expenses', params: { period: 'today' } });
            }}
            style={({ pressed }) => [pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
          >
            <View style={styles.periodCard}>
              <View style={styles.periodHeader}>
                <View style={[styles.periodIconBg, { backgroundColor: Colors.accent + '20' }]}>
                  <Ionicons name="today" size={18} color={Colors.accent} />
                </View>
                <View style={styles.periodTitleArea}>
                  <Text style={styles.periodTitle}>Today</Text>
                  <Text style={styles.periodSubtitle}>
                    {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
              </View>
              <View style={styles.periodAmounts}>
                <View style={styles.periodAmountItem}>
                  <Text style={styles.periodAmountLabel}>Spent</Text>
                  <Text style={[
                    styles.periodAmountValue,
                    dailyLimit > 0 && todayTotal > dailyLimit && { color: Colors.danger },
                  ]}>{formatPKR(todayTotal)}</Text>
                </View>
                {dailyLimit > 0 ? (
                  <>
                    <View style={styles.periodDivider} />
                    <View style={styles.periodAmountItem}>
                      <Text style={styles.periodAmountLabel}>Budget</Text>
                      <Text style={styles.periodAmountValue}>{formatPKR(dailyLimit)}</Text>
                    </View>
                    <View style={styles.periodDivider} />
                    <View style={styles.periodAmountItem}>
                      <Text style={styles.periodAmountLabel}>
                        {dailyLimit - todayTotal >= 0 ? 'Left' : 'Over'}
                      </Text>
                      <Text style={[
                        styles.periodAmountValue,
                        { color: dailyLimit - todayTotal >= 0 ? Colors.success : Colors.danger },
                      ]}>{formatPKR(Math.abs(dailyLimit - todayTotal))}</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.periodDivider} />
                    <View style={styles.periodAmountItem}>
                      <Text style={styles.periodAmountLabel}>Expenses</Text>
                      <Text style={styles.periodAmountValue}>{todayExpenses.length}</Text>
                    </View>
                  </>
                )}
              </View>
              {dailyLimit > 0 ? (
                <View style={styles.periodBarBg}>
                  <View
                    style={[
                      styles.periodBarFill,
                      {
                        width: `${Math.min((todayTotal / dailyLimit) * 100, 100)}%` as any,
                        backgroundColor: todayTotal > dailyLimit ? Colors.danger : Colors.accent,
                      },
                    ]}
                  />
                </View>
              ) : null}
            </View>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(500)}>
          <Text style={styles.sectionTitle}>Spending Breakdown</Text>
          <SpendingChart expenses={monthExpenses} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(500)}>
          <View style={styles.recentHeader}>
            <Text style={styles.sectionTitle}>Recent Expenses</Text>
            {monthExpenses.length > 5 ? (
              <Pressable onPress={() => router.push('/history')}>
                <Text style={styles.seeAll}>See All</Text>
              </Pressable>
            ) : null}
          </View>
          {recentExpenses.length === 0 ? (
            <View style={styles.emptyRecent}>
              <Ionicons name="receipt-outline" size={40} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>No expenses yet</Text>
              <Text style={styles.emptySubText}>Use Say It or Type It to add your first expense</Text>
            </View>
          ) : (
            recentExpenses.map((expense, index) => (
              <ExpenseCard
                key={expense.id}
                expense={expense}
                onDelete={handleDelete}
                onEdit={handleEdit}
                index={index}
              />
            ))
          )}
        </Animated.View>
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  monthLabel: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  plusBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
  },
  headerBtnAccent: {
    backgroundColor: Colors.accent,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  summaryIconBg: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  summaryAmount: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 20,
  },
  seeAll: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
  },
  emptyRecent: {
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
  periodCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  periodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  periodIconBg: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodTitleArea: {
    flex: 1,
  },
  periodTitle: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  periodSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
    marginTop: 1,
  },
  periodAmounts: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  periodAmountItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  periodAmountLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  periodAmountValue: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  periodDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.border,
  },
  periodBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.surface,
    marginTop: 12,
    overflow: 'hidden',
  },
  periodBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});
