import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  RefreshControl,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import BudgetBar from '@/components/BudgetBar';
import CategoryPill from '@/components/CategoryPill';
import {
  getExpenses,
  getBudgets,
  setBudget,
  deleteBudget,
  getMonthlyBudget,
  setMonthlyBudget,
  getExpensesForMonth,
  getMonthKey,
  getMonthLabel,
  getTotalForCategory,
  formatPKR,
  getTotalExpenses,
  CATEGORIES,
  Budget,
  Expense,
  MonthlyBudget,
} from '@/lib/storage';

export default function BudgetsScreen() {
  const insets = useSafeAreaInsets();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [monthlyBudget, setMonthlyBudgetState] = useState<MonthlyBudget | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showMonthlyModal, setShowMonthlyModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const currentMonth = getMonthKey();

  const loadData = useCallback(async () => {
    const [allExpenses, allBudgets, mb] = await Promise.all([
      getExpenses(),
      getBudgets(),
      getMonthlyBudget(currentMonth),
    ]);
    setExpenses(allExpenses);
    setBudgets(allBudgets);
    setMonthlyBudgetState(mb);
  }, [currentMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const monthExpenses = getExpensesForMonth(expenses, currentMonth);
  const monthBudgets = budgets.filter(b => b.month === currentMonth);
  const totalSpent = getTotalExpenses(monthExpenses);
  const monthlyLimit = monthlyBudget?.totalLimit || 0;
  const remaining = monthlyLimit - totalSpent;

  const openAddCategoryBudget = () => {
    setEditingBudget(null);
    setSelectedCategory('');
    setBudgetAmount('');
    setShowCategoryModal(true);
  };

  const openEditCategoryBudget = (budget: Budget) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingBudget(budget);
    setSelectedCategory(budget.category);
    setBudgetAmount(budget.limit.toString());
    setShowCategoryModal(true);
  };

  const handleSaveCategoryBudget = async () => {
    if (!selectedCategory || !budgetAmount) {
      Alert.alert('Missing Info', 'Please select a category and enter a budget amount');
      return;
    }
    const amount = parseInt(budgetAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid budget amount');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await setBudget({ category: selectedCategory, limit: amount, month: currentMonth });
    await loadData();
    setShowCategoryModal(false);
    setSelectedCategory('');
    setBudgetAmount('');
    setEditingBudget(null);
  };

  const handleDeleteBudget = (category: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Remove Budget', 'Remove budget for this category?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteBudget(category, currentMonth);
          await loadData();
        },
      },
    ]);
  };

  const openMonthlyBudgetModal = () => {
    setMonthlyAmount(monthlyLimit > 0 ? monthlyLimit.toString() : '');
    setShowMonthlyModal(true);
  };

  const handleSaveMonthlyBudget = async () => {
    if (!monthlyAmount) {
      Alert.alert('Missing Amount', 'Please enter your monthly budget');
      return;
    }
    const amount = parseInt(monthlyAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await setMonthlyBudget({ month: currentMonth, totalLimit: amount });
    await loadData();
    setShowMonthlyModal(false);
    setMonthlyAmount('');
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
            <Text style={styles.screenTitle}>Budgets</Text>
            <Text style={styles.monthLabel}>{getMonthLabel(currentMonth)}</Text>
          </View>
          <Pressable
            onPress={openAddCategoryBudget}
            style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] }]}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </Pressable>
        </View>

        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <View style={styles.monthlyCard}>
            <View style={styles.monthlyHeader}>
              <View style={styles.monthlyTitleRow}>
                <View style={[styles.monthlyIconBg, { backgroundColor: Colors.primary + '15' }]}>
                  <Ionicons name="wallet" size={20} color={Colors.primary} />
                </View>
                <Text style={styles.monthlyTitle}>Monthly Budget</Text>
              </View>
              <Pressable
                onPress={openMonthlyBudgetModal}
                hitSlop={12}
                style={({ pressed }) => [styles.editBudgetBtn, pressed && { opacity: 0.6 }]}
                testID="edit-monthly-budget"
              >
                <Ionicons name="create-outline" size={20} color={Colors.primary} />
              </Pressable>
            </View>

            {monthlyLimit > 0 ? (
              <>
                <View style={styles.monthlyAmounts}>
                  <View style={styles.monthlyAmountItem}>
                    <Text style={styles.monthlyAmountLabel}>Budget</Text>
                    <Text style={styles.monthlyAmountValue}>{formatPKR(monthlyLimit)}</Text>
                  </View>
                  <View style={styles.monthlyDivider} />
                  <View style={styles.monthlyAmountItem}>
                    <Text style={styles.monthlyAmountLabel}>Spent</Text>
                    <Text style={[styles.monthlyAmountValue, totalSpent > monthlyLimit && { color: Colors.danger }]}>
                      {formatPKR(totalSpent)}
                    </Text>
                  </View>
                  <View style={styles.monthlyDivider} />
                  <View style={styles.monthlyAmountItem}>
                    <Text style={styles.monthlyAmountLabel}>Remaining</Text>
                    <Text style={[styles.monthlyAmountValue, { color: remaining >= 0 ? Colors.success : Colors.danger }]}>
                      {formatPKR(Math.abs(remaining))}
                    </Text>
                    {remaining < 0 ? (
                      <Text style={styles.overBudgetLabel}>over</Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.monthlyBarBg}>
                  <View
                    style={[
                      styles.monthlyBarFill,
                      {
                        width: `${Math.min((totalSpent / monthlyLimit) * 100, 100)}%` as any,
                        backgroundColor: totalSpent > monthlyLimit ? Colors.danger : Colors.primary,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.monthlyPercent}>
                  {Math.round((totalSpent / monthlyLimit) * 100)}% used
                </Text>
              </>
            ) : (
              <Pressable onPress={openMonthlyBudgetModal} style={styles.monthlyEmpty}>
                <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                <Text style={styles.monthlyEmptyText}>Tap to set your monthly budget</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Category Budgets</Text>
          </View>

          {monthBudgets.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="layers-outline" size={40} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>No category budgets</Text>
              <Text style={styles.emptySubText}>Tap + to set limits for specific categories</Text>
            </View>
          ) : (
            monthBudgets.map((budget, index) => (
              <Pressable
                key={budget.category}
                onPress={() => openEditCategoryBudget(budget)}
                onLongPress={() => handleDeleteBudget(budget.category)}
                delayLongPress={500}
              >
                <BudgetBar
                  category={budget.category}
                  spent={getTotalForCategory(monthExpenses, budget.category)}
                  limit={budget.limit}
                  index={index}
                />
              </Pressable>
            ))
          )}
        </Animated.View>
      </ScrollView>

      <Modal
        visible={showCategoryModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingBudget ? 'Edit Budget' : 'Add Category Budget'}
            </Text>
            <Pressable onPress={() => setShowCategoryModal(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalSectionLabel}>Select Category</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map(cat => (
                <CategoryPill
                  key={cat.key}
                  label={cat.label}
                  icon={cat.icon}
                  categoryKey={cat.key}
                  selected={selectedCategory === cat.key}
                  onPress={() => setSelectedCategory(cat.key)}
                />
              ))}
            </View>

            <Text style={styles.modalSectionLabel}>Monthly Limit (PKR)</Text>
            <TextInput
              style={styles.amountInput}
              value={budgetAmount}
              onChangeText={setBudgetAmount}
              keyboardType="numeric"
              placeholder="e.g. 15000"
              placeholderTextColor={Colors.textSecondary}
            />

            <View style={styles.modalButtonRow}>
              <Pressable
                onPress={handleSaveCategoryBudget}
                style={({ pressed }) => [
                  styles.saveButton,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
              >
                <Text style={styles.saveButtonText}>
                  {editingBudget ? 'Update Budget' : 'Save Budget'}
                </Text>
              </Pressable>
              {editingBudget ? (
                <Pressable
                  onPress={() => {
                    setShowCategoryModal(false);
                    handleDeleteBudget(editingBudget.category);
                  }}
                  style={({ pressed }) => [
                    styles.deleteButton,
                    pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                  ]}
                >
                  <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                  <Text style={styles.deleteButtonText}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showMonthlyModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMonthlyModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {monthlyLimit > 0 ? 'Edit Monthly Budget' : 'Set Monthly Budget'}
            </Text>
            <Pressable onPress={() => setShowMonthlyModal(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </Pressable>
          </View>

          <View style={styles.monthlyModalContent}>
            <View style={styles.monthlyModalIcon}>
              <Ionicons name="wallet" size={40} color={Colors.primary} />
            </View>
            <Text style={styles.monthlyModalLabel}>
              How much do you want to spend this month?
            </Text>
            <Text style={styles.monthlyModalSub}>{getMonthLabel(currentMonth)}</Text>

            <View style={styles.monthlyInputRow}>
              <Text style={styles.currencyPrefix}>Rs.</Text>
              <TextInput
                style={styles.monthlyInput}
                value={monthlyAmount}
                onChangeText={setMonthlyAmount}
                keyboardType="numeric"
                placeholder="50,000"
                placeholderTextColor={Colors.border}
                autoFocus
              />
            </View>

            <Pressable
              onPress={handleSaveMonthlyBudget}
              style={({ pressed }) => [
                styles.saveButton,
                { marginTop: 24 },
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Text style={styles.saveButtonText}>
                {monthlyLimit > 0 ? 'Update Budget' : 'Set Budget'}
              </Text>
            </Pressable>
          </View>
        </View>
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
  screenTitle: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  monthLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthlyCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  monthlyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  monthlyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  monthlyIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthlyTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  monthlyAmounts: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthlyAmountItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  monthlyDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.border,
  },
  monthlyAmountLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  monthlyAmountValue: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  overBudgetLabel: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.danger,
    textTransform: 'uppercase' as const,
  },
  monthlyBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.surface,
    marginTop: 14,
    overflow: 'hidden',
  },
  monthlyBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  monthlyPercent: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
    textAlign: 'right',
    marginTop: 6,
  },
  editBudgetBtn: {
    padding: 6,
  },
  monthlyEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  monthlyEmptyText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.primary,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  emptyContainer: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 28,
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
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  modalSectionLabel: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amountInput: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalButtonRow: {
    gap: 12,
    marginTop: 8,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.danger + '40',
    backgroundColor: Colors.danger + '08',
  },
  deleteButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.danger,
  },
  monthlyModalContent: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  monthlyModalIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  monthlyModalLabel: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    textAlign: 'center',
  },
  monthlyModalSub: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  monthlyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currencyPrefix: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: Colors.textSecondary,
  },
  monthlyInput: {
    fontSize: 36,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    textAlign: 'center',
    minWidth: 160,
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
});
