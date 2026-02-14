import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Pressable,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
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
  formatPKR,
  getTotalExpenses,
  CATEGORIES,
} from '@/lib/storage';

type TabType = 'monthly' | 'weekly' | 'daily';

interface PeriodGroup {
  key: string;
  label: string;
  sublabel?: string;
  expenses: Expense[];
  total: number;
  isCurrent: boolean;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - ((day + 6) % 7));
  date.setHours(0, 0, 0, 0);
  return date;
}

function getSunday(monday: Date): Date {
  const sun = new Date(monday);
  sun.setDate(monday.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return sun;
}

function formatWeekLabel(monday: Date): string {
  const sunday = getSunday(monday);
  const startStr = monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const endStr = sunday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${startStr} - ${endStr}`;
}

function formatDayLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
}

function groupByMonth(expenses: Expense[]): PeriodGroup[] {
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const groups = new Map<string, Expense[]>();

  if (!groups.has(currentKey)) groups.set(currentKey, []);

  for (const e of expenses) {
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }

  const sorted = Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  return sorted.map(([key, exps]) => {
    const [year, month] = key.split('-').map(Number);
    const date = new Date(year, month - 1);
    return {
      key,
      label: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      expenses: exps,
      total: getTotalExpenses(exps),
      isCurrent: key === currentKey,
    };
  });
}

function groupByWeek(expenses: Expense[]): PeriodGroup[] {
  const now = new Date();
  const currentMonday = getMonday(now);
  const currentKey = currentMonday.toISOString().slice(0, 10);
  const groups = new Map<string, { monday: Date; expenses: Expense[] }>();

  if (!groups.has(currentKey)) groups.set(currentKey, { monday: currentMonday, expenses: [] });

  for (const e of expenses) {
    const d = new Date(e.date);
    const monday = getMonday(d);
    const key = monday.toISOString().slice(0, 10);
    if (!groups.has(key)) groups.set(key, { monday, expenses: [] });
    groups.get(key)!.expenses.push(e);
  }

  const sorted = Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  return sorted.map(([key, { monday, expenses: exps }]) => ({
    key,
    label: formatWeekLabel(monday),
    sublabel: `${monday.getFullYear()}`,
    expenses: exps,
    total: getTotalExpenses(exps),
    isCurrent: key === currentKey,
  }));
}

function groupByDay(expenses: Expense[]): PeriodGroup[] {
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const groups = new Map<string, { date: Date; expenses: Expense[] }>();

  if (!groups.has(todayKey)) groups.set(todayKey, { date: now, expenses: [] });

  for (const e of expenses) {
    const d = new Date(e.date);
    const key = d.toISOString().slice(0, 10);
    if (!groups.has(key)) groups.set(key, { date: d, expenses: [] });
    groups.get(key)!.expenses.push(e);
  }

  const sorted = Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  return sorted.map(([key, { date, expenses: exps }]) => ({
    key,
    label: formatDayLabel(date),
    sublabel: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    expenses: exps,
    total: getTotalExpenses(exps),
    isCurrent: key === todayKey,
  }));
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('monthly');
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const loadExpenses = useCallback(async () => {
    const all = await getExpenses();
    setExpenses(all);
  }, []);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  useEffect(() => {
    const interval = setInterval(loadExpenses, 3000);
    return () => clearInterval(interval);
  }, [loadExpenses]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadExpenses();
    setRefreshing(false);
  }, [loadExpenses]);

  const groups = useMemo(() => {
    switch (activeTab) {
      case 'monthly': return groupByMonth(expenses);
      case 'weekly': return groupByWeek(expenses);
      case 'daily': return groupByDay(expenses);
    }
  }, [expenses, activeTab]);

  useEffect(() => {
    if (groups.length > 0) {
      setExpandedPeriod(groups[0].key);
    }
  }, [activeTab]);

  const handleTabChange = (tab: TabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
    setSelectedCategory(null);
  };

  const handleTogglePeriod = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedPeriod(prev => prev === key ? null : key);
  };

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

  const sections = useMemo(() => {
    return groups.map(group => {
      const isExpanded = expandedPeriod === group.key;
      let filteredExpenses = group.expenses;
      if (selectedCategory && isExpanded) {
        filteredExpenses = filteredExpenses.filter(e => e.category === selectedCategory);
      }
      return {
        key: group.key,
        label: group.label,
        sublabel: group.sublabel,
        total: group.total,
        count: group.expenses.length,
        isCurrent: group.isCurrent,
        isExpanded,
        data: isExpanded ? filteredExpenses : [],
        filteredTotal: getTotalExpenses(filteredExpenses),
        filteredCount: filteredExpenses.length,
      };
    });
  }, [groups, expandedPeriod, selectedCategory]);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 12 }]}>
        <Text style={styles.screenTitle}>History</Text>
        <View style={styles.tabBar}>
          {(['monthly', 'weekly', 'daily'] as TabType[]).map(tab => (
            <Pressable
              key={tab}
              onPress={() => handleTabChange(tab)}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'monthly' ? 'Monthly' : tab === 'weekly' ? 'Weekly' : 'Daily'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {expandedPeriod && (
        <View style={styles.filterRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContent}
          >
            <CategoryPill
              label="All"
              icon="grid"
              categoryKey=""
              selected={selectedCategory === null}
              onPress={() => setSelectedCategory(null)}
            />
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
          </ScrollView>
        </View>
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Platform.OS === 'web' ? 34 : 120 },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        renderSectionHeader={({ section }) => {
          const s = section as (typeof sections)[0];
          return (
            <Pressable
              onPress={() => handleTogglePeriod(s.key)}
              style={({ pressed }) => [
                styles.periodCard,
                s.isExpanded && styles.periodCardExpanded,
                pressed && { opacity: 0.85 },
              ]}
            >
              <View style={styles.periodLeft}>
                <View style={[
                  styles.periodIconBg,
                  {
                    backgroundColor: s.isCurrent
                      ? Colors.primary + '15'
                      : Colors.surface,
                  },
                ]}>
                  <Ionicons
                    name={
                      activeTab === 'monthly' ? 'calendar' :
                      activeTab === 'weekly' ? 'calendar-outline' : 'today'
                    }
                    size={18}
                    color={s.isCurrent ? Colors.primary : Colors.textSecondary}
                  />
                </View>
                <View>
                  <View style={styles.periodLabelRow}>
                    <Text style={[
                      styles.periodLabel,
                      s.isCurrent && styles.periodLabelCurrent,
                    ]}>{s.label}</Text>
                    {s.isCurrent ? (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>Current</Text>
                      </View>
                    ) : null}
                  </View>
                  {s.sublabel && !s.isCurrent ? (
                    <Text style={styles.periodSublabel}>{s.sublabel}</Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.periodRight}>
                <Text style={styles.periodTotal}>{formatPKR(s.total)}</Text>
                <View style={styles.periodMeta}>
                  <Text style={styles.periodCount}>{s.count} {s.count === 1 ? 'item' : 'items'}</Text>
                  <Ionicons
                    name={s.isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={Colors.textSecondary}
                  />
                </View>
              </View>
            </Pressable>
          );
        }}
        renderItem={({ item, index, section }) => {
          const s = section as (typeof sections)[0];
          if (!s.isExpanded) return null;
          return (
            <ExpenseCard
              expense={item}
              onDelete={handleDelete}
              onEdit={handleEdit}
              index={index}
            />
          );
        }}
        renderSectionFooter={({ section }) => {
          const s = section as (typeof sections)[0];
          if (!s.isExpanded) return null;
          if (s.data.length === 0) {
            return (
              <View style={styles.emptyPeriod}>
                <Ionicons name="receipt-outline" size={28} color={Colors.textSecondary} />
                <Text style={styles.emptyPeriodText}>
                  {selectedCategory ? 'No expenses in this category' : 'No expenses recorded'}
                </Text>
              </View>
            );
          }
          if (selectedCategory && s.filteredCount !== s.count) {
            return (
              <View style={styles.filteredBar}>
                <Text style={styles.filteredText}>
                  Showing {s.filteredCount} of {s.count} expenses ({formatPKR(s.filteredTotal)})
                </Text>
              </View>
            );
          }
          return null;
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No expense history</Text>
            <Text style={styles.emptySubText}>Your expenses will appear here</Text>
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
    gap: 12,
  },
  screenTitle: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: Colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  filterRow: {
    marginBottom: 6,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  listContent: {
    paddingTop: 4,
    gap: 2,
  },
  periodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  periodCardExpanded: {
    borderColor: Colors.primary + '40',
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    marginBottom: 2,
  },
  periodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  periodIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  periodLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  periodLabelCurrent: {
    color: Colors.primary,
  },
  periodSublabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginTop: 1,
  },
  currentBadge: {
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  currentBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  periodRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  periodTotal: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  periodMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  periodCount: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  emptyPeriod: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 6,
  },
  emptyPeriodText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  filteredBar: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 4,
  },
  filteredText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
    textAlign: 'center',
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
