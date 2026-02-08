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
  getExpensesForMonth,
  getMonthKey,
  getMonthLabel,
  getTotalForCategory,
  formatPKR,
  getTotalExpenses,
  CATEGORIES,
  Budget,
  Expense,
} from '@/lib/storage';

export default function BudgetsScreen() {
  const insets = useSafeAreaInsets();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const currentMonth = getMonthKey();

  const loadData = useCallback(async () => {
    const [allExpenses, allBudgets] = await Promise.all([getExpenses(), getBudgets()]);
    setExpenses(allExpenses);
    setBudgets(allBudgets);
  }, []);

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
  const totalBudget = monthBudgets.reduce((sum, b) => sum + b.limit, 0);
  const totalSpent = getTotalExpenses(monthExpenses);

  const handleAddBudget = async () => {
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
    setShowAddModal(false);
    setSelectedCategory('');
    setBudgetAmount('');
  };

  const handleDeleteBudget = (category: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Remove Budget', `Remove budget for this category?`, [
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
            onPress={() => setShowAddModal(true)}
            style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] }]}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </Pressable>
        </View>

        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.overviewCard}>
          <View style={styles.overviewRow}>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>Total Budget</Text>
              <Text style={styles.overviewAmount}>{formatPKR(totalBudget)}</Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>Total Spent</Text>
              <Text style={[styles.overviewAmount, totalSpent > totalBudget && totalBudget > 0 && { color: Colors.danger }]}>
                {formatPKR(totalSpent)}
              </Text>
            </View>
          </View>
          {totalBudget > 0 ? (
            <View style={styles.overviewBarBg}>
              <View
                style={[
                  styles.overviewBarFill,
                  {
                    width: `${Math.min((totalSpent / totalBudget) * 100, 100)}%` as any,
                    backgroundColor: totalSpent > totalBudget ? Colors.danger : Colors.primary,
                  },
                ]}
              />
            </View>
          ) : null}
        </Animated.View>

        {monthBudgets.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="wallet-outline" size={48} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No budgets set</Text>
            <Text style={styles.emptySubText}>Set budgets for your categories to track spending limits</Text>
          </View>
        ) : (
          monthBudgets.map((budget, index) => (
            <Pressable key={budget.category} onLongPress={() => handleDeleteBudget(budget.category)}>
              <BudgetBar
                category={budget.category}
                spent={getTotalForCategory(monthExpenses, budget.category)}
                limit={budget.limit}
                index={index}
              />
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Set Budget</Text>
            <Pressable onPress={() => setShowAddModal(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
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

            <Pressable
              onPress={handleAddBudget}
              style={({ pressed }) => [
                styles.saveButton,
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Text style={styles.saveButtonText}>Save Budget</Text>
            </Pressable>
          </ScrollView>
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
    gap: 12,
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
  overviewCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overviewItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  overviewDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
  },
  overviewLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  overviewAmount: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  overviewBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.surface,
    marginTop: 14,
    overflow: 'hidden',
  },
  overviewBarFill: {
    height: '100%',
    borderRadius: 3,
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
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
});
