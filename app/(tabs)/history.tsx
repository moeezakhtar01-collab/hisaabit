import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
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
import ExpenseCard from '@/components/ExpenseCard';
import CategoryPill from '@/components/CategoryPill';
import {
  Expense,
  getExpenses,
  deleteExpense,
  getExpensesForMonth,
  getMonthKey,
  getMonthLabel,
  formatPKR,
  getTotalExpenses,
  CATEGORIES,
} from '@/lib/storage';

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);

  const loadExpenses = useCallback(async () => {
    const all = await getExpenses();
    setExpenses(all);
  }, []);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const currentDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - monthOffset);
    return d;
  }, [monthOffset]);

  const monthKey = getMonthKey(currentDate);
  const monthExpenses = useMemo(() => {
    let filtered = getExpensesForMonth(expenses, monthKey);
    if (selectedCategory) {
      filtered = filtered.filter(e => e.category === selectedCategory);
    }
    return filtered;
  }, [expenses, monthKey, selectedCategory]);

  const totalFiltered = getTotalExpenses(monthExpenses);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadExpenses();
    setRefreshing(false);
  }, [loadExpenses]);

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
    Alert.alert('Delete Expense', 'Remove this expense?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteExpense(id);
          await loadExpenses();
        },
      },
    ]);
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const renderItem = useCallback(
    ({ item, index }: { item: Expense; index: number }) => (
      <ExpenseCard expense={item} onDelete={handleDelete} onEdit={handleEdit} index={index} />
    ),
    []
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 12 }]}>
        <Text style={styles.screenTitle}>History</Text>

        <View style={styles.monthNav}>
          <Pressable onPress={() => setMonthOffset(prev => prev + 1)} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={Colors.primary} />
          </Pressable>
          <Text style={styles.monthText}>{getMonthLabel(monthKey)}</Text>
          <Pressable
            onPress={() => setMonthOffset(prev => Math.max(0, prev - 1))}
            hitSlop={12}
            disabled={monthOffset === 0}
          >
            <Ionicons name="chevron-forward" size={22} color={monthOffset === 0 ? Colors.border : Colors.primary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.filterRow}>
        <FlatList
          horizontal
          data={[{ key: '', label: 'All', icon: 'grid' as const }, ...CATEGORIES]}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
          keyExtractor={item => item.key}
          renderItem={({ item }) => (
            <CategoryPill
              label={item.label}
              icon={item.icon}
              categoryKey={item.key}
              selected={selectedCategory === (item.key || null)}
              onPress={() => setSelectedCategory(item.key || null)}
            />
          )}
        />
      </View>

      <Animated.View entering={FadeInDown.duration(300)} style={styles.totalBar}>
        <Text style={styles.totalLabel}>{monthExpenses.length} expenses</Text>
        <Text style={styles.totalAmount}>{formatPKR(totalFiltered)}</Text>
      </Animated.View>

      <FlatList
        data={monthExpenses}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Platform.OS === 'web' ? 34 : 120 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No expenses found</Text>
            <Text style={styles.emptySubText}>
              {selectedCategory ? 'Try a different filter' : 'No expenses recorded this month'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 10,
  },
  screenTitle: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  monthText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  filterRow: {
    marginBottom: 8,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  totalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  totalLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  totalAmount: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  listContent: {
    paddingTop: 4,
  },
  emptyContainer: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 32,
    marginHorizontal: 16,
    marginTop: 20,
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
});
