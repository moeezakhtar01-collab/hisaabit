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
  BudgetSettings,
  getBudgetSettingsApi,
  saveBudgetSettings,
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
  const [budgetSettings, setBudgetSettingsState] = useState<BudgetSettings | null>(null);
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);
  const [dailyAmount, setDailyAmount] = useState('');
  const [weeklyAmount, setWeeklyAmount] = useState('');
  const currentMonth = getMonthKey();

  const loadData = useCallback(async () => {
    const [allExpenses, allBudgets, mb, bs] = await Promise.all([
      getExpenses(),
      getBudgets(),
      getMonthlyBudget(currentMonth),
      getBudgetSettingsApi(),
    ]);
    setExpenses(allExpenses);
    setBudgets(allBudgets);
    setMonthlyBudgetState(mb);
    setBudgetSettingsState(bs);
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

  const currentCategoryTotal = monthBudgets.reduce((sum, b) => sum + b.limit, 0);

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

    if (monthlyLimit > 0) {
      const existingForCategory = monthBudgets.find(b => b.category === selectedCategory)?.limit || 0;
      const newTotal = currentCategoryTotal - existingForCategory + amount;
      if (newTotal > monthlyLimit) {
        const available = monthlyLimit - (currentCategoryTotal - existingForCategory);
        Alert.alert(
          'Exceeds Monthly Budget',
          `This would bring your category budgets total to ${formatPKR(newTotal)}, which exceeds your monthly budget of ${formatPKR(monthlyLimit)}.\n\nYou can set up to ${formatPKR(Math.max(available, 0))} for this category.`
        );
        return;
      }
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

    if (currentCategoryTotal > 0 && amount < currentCategoryTotal) {
      Alert.alert(
        'Budget Too Low',
        `Your category budgets already total ${formatPKR(currentCategoryTotal)}. The monthly budget must be at least this amount.\n\nReduce your category budgets first, or set a higher monthly budget.`
      );
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await setMonthlyBudget({ month: currentMonth, totalLimit: amount });
    await loadData();
    setShowMonthlyModal(false);
    setMonthlyAmount('');
  };

  const openDailyModal = () => {
    setDailyAmount(budgetSettings?.dailyLimit ? budgetSettings.dailyLimit.toString() : '');
    setShowDailyModal(true);
  };

  const openWeeklyModal = () => {
    setWeeklyAmount(budgetSettings?.weeklyLimit ? budgetSettings.weeklyLimit.toString() : '');
    setShowWeeklyModal(true);
  };

  const handleSaveDailyBudget = async () => {
    if (!dailyAmount) {
      Alert.alert('Missing Amount', 'Please enter your daily budget');
      return;
    }
    const amount = parseInt(dailyAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await saveBudgetSettings({ dailyLimit: amount });
    await loadData();
    setShowDailyModal(false);
    setDailyAmount('');
  };

  const handleSaveWeeklyBudget = async () => {
    if (!weeklyAmount) {
      Alert.alert('Missing Amount', 'Please enter your weekly budget');
      return;
    }
    const amount = parseInt(weeklyAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await saveBudgetSettings({ weeklyLimit: amount });
    await loadData();
    setShowWeeklyModal(false);
    setWeeklyAmount('');
  };

  const handleRemoveDailyBudget = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Remove Daily Budget', 'Are you sure you want to remove your daily budget?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await saveBudgetSettings({ dailyLimit: null });
          await loadData();
          setShowDailyModal(false);
          setDailyAmount('');
        },
      },
    ]);
  };

  const handleRemoveWeeklyBudget = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Remove Weekly Budget', 'Are you sure you want to remove your weekly budget?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await saveBudgetSettings({ weeklyLimit: null });
          await loadData();
          setShowWeeklyModal(false);
          setWeeklyAmount('');
        },
      },
    ]);
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

        <View style={styles.periodBudgetRow}>
          <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.periodBudgetCardWrapper}>
            <View style={styles.periodBudgetCard}>
              <View style={styles.periodBudgetHeader}>
                <View style={[styles.periodBudgetIconBg, { backgroundColor: Colors.warning + '15' }]}>
                  <Ionicons name="today-outline" size={16} color={Colors.warning} />
                </View>
                <Text style={styles.periodBudgetTitle}>Daily Budget</Text>
              </View>
              {budgetSettings?.dailyLimit ? (
                <View style={styles.periodBudgetBody}>
                  <Text style={styles.periodBudgetAmount}>{formatPKR(budgetSettings.dailyLimit)}</Text>
                  <Pressable
                    onPress={openDailyModal}
                    hitSlop={12}
                    style={({ pressed }) => [styles.periodBudgetEditBtn, pressed && { opacity: 0.6 }]}
                  >
                    <Ionicons name="create-outline" size={16} color={Colors.primary} />
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={openDailyModal} style={styles.periodBudgetEmpty}>
                  <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
                  <Text style={styles.periodBudgetEmptyText}>Tap to set</Text>
                </Pressable>
              )}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(175).duration(400)} style={styles.periodBudgetCardWrapper}>
            <View style={styles.periodBudgetCard}>
              <View style={styles.periodBudgetHeader}>
                <View style={[styles.periodBudgetIconBg, { backgroundColor: Colors.accent + '15' }]}>
                  <Ionicons name="calendar-outline" size={16} color={Colors.accent} />
                </View>
                <Text style={styles.periodBudgetTitle}>Weekly Budget</Text>
              </View>
              {budgetSettings?.weeklyLimit ? (
                <View style={styles.periodBudgetBody}>
                  <Text style={styles.periodBudgetAmount}>{formatPKR(budgetSettings.weeklyLimit)}</Text>
                  <Pressable
                    onPress={openWeeklyModal}
                    hitSlop={12}
                    style={({ pressed }) => [styles.periodBudgetEditBtn, pressed && { opacity: 0.6 }]}
                  >
                    <Ionicons name="create-outline" size={16} color={Colors.primary} />
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={openWeeklyModal} style={styles.periodBudgetEmpty}>
                  <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
                  <Text style={styles.periodBudgetEmptyText}>Tap to set</Text>
                </Pressable>
              )}
            </View>
          </Animated.View>
        </View>

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
            {monthlyLimit > 0 && (
              <View style={styles.budgetHintRow}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.budgetHintText}>
                  {(() => {
                    const existingForCat = monthBudgets.find(b => b.category === selectedCategory)?.limit || 0;
                    const usedByOthers = currentCategoryTotal - existingForCat;
                    const available = monthlyLimit - usedByOthers;
                    return `Available: ${formatPKR(Math.max(available, 0))} of ${formatPKR(monthlyLimit)} monthly budget`;
                  })()}
                </Text>
              </View>
            )}

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

      <Modal
        visible={showDailyModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDailyModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {budgetSettings?.dailyLimit ? 'Edit Daily Budget' : 'Set Daily Budget'}
            </Text>
            <Pressable onPress={() => setShowDailyModal(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </Pressable>
          </View>

          <View style={styles.monthlyModalContent}>
            <View style={[styles.monthlyModalIcon, { backgroundColor: Colors.warning + '12' }]}>
              <Ionicons name="today" size={40} color={Colors.warning} />
            </View>
            <Text style={styles.monthlyModalLabel}>
              How much do you want to spend per day?
            </Text>

            <View style={styles.monthlyInputRow}>
              <Text style={styles.currencyPrefix}>Rs.</Text>
              <TextInput
                style={styles.monthlyInput}
                value={dailyAmount}
                onChangeText={setDailyAmount}
                keyboardType="numeric"
                placeholder="2,000"
                placeholderTextColor={Colors.border}
                autoFocus
              />
            </View>

            <Pressable
              onPress={handleSaveDailyBudget}
              style={({ pressed }) => [
                styles.saveButton,
                { marginTop: 24 },
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Text style={styles.saveButtonText}>
                {budgetSettings?.dailyLimit ? 'Update Budget' : 'Set Budget'}
              </Text>
            </Pressable>
            {budgetSettings?.dailyLimit ? (
              <Pressable
                onPress={handleRemoveDailyBudget}
                style={({ pressed }) => [
                  styles.deleteButton,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
              >
                <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                <Text style={styles.deleteButtonText}>Remove Daily Budget</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showWeeklyModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowWeeklyModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {budgetSettings?.weeklyLimit ? 'Edit Weekly Budget' : 'Set Weekly Budget'}
            </Text>
            <Pressable onPress={() => setShowWeeklyModal(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </Pressable>
          </View>

          <View style={styles.monthlyModalContent}>
            <View style={[styles.monthlyModalIcon, { backgroundColor: Colors.accent + '12' }]}>
              <Ionicons name="calendar" size={40} color={Colors.accent} />
            </View>
            <Text style={styles.monthlyModalLabel}>
              How much do you want to spend per week?
            </Text>

            <View style={styles.monthlyInputRow}>
              <Text style={styles.currencyPrefix}>Rs.</Text>
              <TextInput
                style={styles.monthlyInput}
                value={weeklyAmount}
                onChangeText={setWeeklyAmount}
                keyboardType="numeric"
                placeholder="10,000"
                placeholderTextColor={Colors.border}
                autoFocus
              />
            </View>

            <Pressable
              onPress={handleSaveWeeklyBudget}
              style={({ pressed }) => [
                styles.saveButton,
                { marginTop: 24 },
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Text style={styles.saveButtonText}>
                {budgetSettings?.weeklyLimit ? 'Update Budget' : 'Set Budget'}
              </Text>
            </Pressable>
            {budgetSettings?.weeklyLimit ? (
              <Pressable
                onPress={handleRemoveWeeklyBudget}
                style={({ pressed }) => [
                  styles.deleteButton,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
              >
                <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                <Text style={styles.deleteButtonText}>Remove Weekly Budget</Text>
              </Pressable>
            ) : null}
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
    marginTop: -8,
    marginBottom: 6,
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
  budgetHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary + '08',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  budgetHintText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
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
  periodBudgetRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
  },
  periodBudgetCardWrapper: {
    flex: 1,
  },
  periodBudgetCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  periodBudgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  periodBudgetIconBg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodBudgetTitle: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  periodBudgetBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  periodBudgetAmount: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  periodBudgetEditBtn: {
    padding: 4,
  },
  periodBudgetEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  periodBudgetEmptyText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.primary,
  },
});
