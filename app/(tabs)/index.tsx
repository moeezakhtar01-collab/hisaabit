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
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import Colors from '@/constants/colors';
import SpendingChart from '@/components/SpendingChart';
import ExpenseCard from '@/components/ExpenseCard';
import {
  Expense,
  MonthlyBudget,
  getExpenses,
  deleteExpense,
  getExpensesForMonth,
  getMonthKey,
  getMonthLabel,
  getMonthlyBudget,
  formatPKR,
  getTotalExpenses,
} from '@/lib/storage';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [monthlyBudget, setMonthlyBudgetState] = useState<MonthlyBudget | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddChoice, setShowAddChoice] = useState(false);
  const currentMonth = getMonthKey();

  const loadExpenses = useCallback(async () => {
    const [all, mb] = await Promise.all([getExpenses(), getMonthlyBudget(currentMonth)]);
    setExpenses(all);
    setMonthlyBudgetState(mb);
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

  const todayExpenses = monthExpenses.filter(
    e => new Date(e.date).toDateString() === new Date().toDateString()
  );
  const todayTotal = getTotalExpenses(todayExpenses);

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
          <View>
            <Text style={styles.monthLabel}>{getMonthLabel(currentMonth)}</Text>
          </View>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowAddChoice(true);
            }}
            style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] }]}
            testID="add-expense-fab"
          >
            <Ionicons name="add" size={24} color="#fff" />
          </Pressable>
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
              <Text style={styles.emptySubText}>Tap + to add your first expense</Text>
            </View>
          ) : (
            recentExpenses.map((expense, index) => (
              <ExpenseCard
                key={expense.id}
                expense={expense}
                onDelete={handleDelete}
                index={index}
              />
            ))
          )}
        </Animated.View>
      </ScrollView>

      <Modal
        visible={showAddChoice}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddChoice(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddChoice(false)}>
          <Animated.View entering={FadeIn.duration(200)} style={[styles.choiceSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.choiceHandle} />
            <Text style={styles.choiceTitle}>Add Expense</Text>

            <Pressable
              onPress={() => {
                setShowAddChoice(false);
                router.push('/voice-expense');
              }}
              style={({ pressed }) => [styles.choiceOption, styles.choiceVoice, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
              testID="add-voice"
            >
              <View style={styles.choiceIconBg}>
                <Ionicons name="mic" size={24} color="#fff" />
              </View>
              <View style={styles.choiceTextBlock}>
                <Text style={styles.choiceOptionTitle}>Say It</Text>
                <Text style={styles.choiceOptionDesc}>Speak your expense and AI will fill it in</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
            </Pressable>

            <Pressable
              onPress={() => {
                setShowAddChoice(false);
                router.push('/add-expense');
              }}
              style={({ pressed }) => [styles.choiceOption, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
              testID="add-manual"
            >
              <View style={[styles.choiceIconBg, { backgroundColor: Colors.accent }]}>
                <Ionicons name="create" size={22} color="#fff" />
              </View>
              <View style={styles.choiceTextBlock}>
                <Text style={styles.choiceOptionTitle}>Type It</Text>
                <Text style={styles.choiceOptionDesc}>Fill in the details yourself</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
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
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  choiceSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 12,
  },
  choiceHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 4,
  },
  choiceTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    marginBottom: 4,
  },
  choiceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  choiceVoice: {
    borderColor: Colors.primary + '40',
    backgroundColor: Colors.primary + '08',
  },
  choiceIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceTextBlock: {
    flex: 1,
    gap: 2,
  },
  choiceOptionTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  choiceOptionDesc: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
});
