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
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useColors } from '@/lib/theme-context';
import type { ThemeColors } from '@/constants/colors';
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
import { generateCsvReport } from '@/lib/report-export';

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
  const colors = useColors();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('monthly');
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportRange, setExportRange] = useState<'week' | 'month' | 'custom' | 'all'>('month');
  const [exporting, setExporting] = useState(false);
  const [customStart, setCustomStart] = useState<Date | null>(null);
  const [customEnd, setCustomEnd] = useState<Date | null>(null);
  const [pickingDate, setPickingDate] = useState<'start' | 'end'>('start');
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const loadExpenses = useCallback(async () => {
    const all = await getExpenses();
    setExpenses(all);
  }, []);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  useEffect(() => {
    const interval = setInterval(loadExpenses, 30000);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleExport = useCallback(async () => {
    if (expenses.length === 0) {
      Alert.alert('No Data', 'No expenses to export.');
      return;
    }
    if (exportRange === 'custom' && (!customStart || !customEnd)) {
      Alert.alert('Select Dates', 'Please pick both a start and end date.');
      return;
    }
    setExporting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const now = new Date();
      let startDate: Date;
      let endDate: Date;

      switch (exportRange) {
        case 'week': {
          startDate = new Date(now);
          const day = startDate.getDay();
          startDate.setDate(startDate.getDate() - ((day + 6) % 7));
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          endDate.setHours(23, 59, 59, 999);
          break;
        }
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'custom':
          startDate = customStart!;
          endDate = customEnd!;
          break;
        case 'all':
        default:
          startDate = new Date(2000, 0, 1);
          endDate = new Date(now);
          endDate.setHours(23, 59, 59, 999);
          break;
      }
      await generateCsvReport(expenses, startDate, endDate);
    } catch {
      Alert.alert('Error', 'Could not generate report.');
    } finally {
      setExporting(false);
      setShowExportModal(false);
    }
  }, [expenses, exportRange, customStart, customEnd]);

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
        <View style={styles.headerRow}>
          <Text style={styles.screenTitle}>History</Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowExportModal(true);
            }}
            style={({ pressed }) => [
              styles.downloadBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="download-outline" size={20} color={colors.primary} />
          </Pressable>
        </View>
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
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
                      ? colors.primary + '15'
                      : colors.surface,
                  },
                ]}>
                  <Ionicons
                    name={
                      activeTab === 'monthly' ? 'calendar' :
                      activeTab === 'weekly' ? 'calendar-outline' : 'today'
                    }
                    size={18}
                    color={s.isCurrent ? colors.primary : colors.textSecondary}
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
                    color={colors.textSecondary}
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
                <Ionicons name="receipt-outline" size={28} color={colors.textSecondary} />
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
            <Ionicons name="document-text-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No expense history</Text>
            <Text style={styles.emptySubText}>Your expenses will appear here</Text>
          </View>
        }
      />

      <Modal
        visible={showExportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExportModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowExportModal(false)}>
          <ScrollView bounces={false}>
            <View style={{ flex: 1, justifyContent: 'flex-end', minHeight: '100%' }}>
              <Pressable style={styles.modalSheet} onPress={() => {}}>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle}>Download Report</Text>
                <Text style={styles.modalSubtitle}>Choose a date range for your CSV export</Text>

                <View style={styles.rangeOptions}>
                  {([
                    { key: 'week', label: 'This Week', icon: 'calendar-outline' },
                    { key: 'month', label: 'This Month', icon: 'calendar' },
                    { key: 'custom', label: 'Custom Range', icon: 'options-outline' },
                    { key: 'all', label: 'All Time', icon: 'infinite' },
                  ] as const).map((opt) => (
                    <Pressable
                      key={opt.key}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setExportRange(opt.key);
                        if (opt.key === 'custom' && !customStart) {
                          setPickingDate('start');
                          setCalendarMonth(new Date());
                        }
                      }}
                      style={[
                        styles.rangeOption,
                        exportRange === opt.key && styles.rangeOptionActive,
                      ]}
                    >
                      <Ionicons
                        name={opt.icon as any}
                        size={20}
                        color={exportRange === opt.key ? colors.primary : colors.textSecondary}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[
                          styles.rangeOptionText,
                          exportRange === opt.key && styles.rangeOptionTextActive,
                        ]}>
                          {opt.label}
                        </Text>
                        {opt.key === 'custom' && customStart && customEnd && (
                          <Text style={styles.customRangeLabel}>
                            {customStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {' \u2013 '}
                            {customEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </Text>
                        )}
                      </View>
                      {exportRange === opt.key && (
                        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                      )}
                    </Pressable>
                  ))}
                </View>

                {exportRange === 'custom' && (
                  <View style={styles.calendarSection}>
                    <View style={styles.datePickerTabs}>
                      <Pressable
                        onPress={() => setPickingDate('start')}
                        style={[styles.datePickerTab, pickingDate === 'start' && styles.datePickerTabActive]}
                      >
                        <Text style={[styles.datePickerTabLabel, pickingDate === 'start' && styles.datePickerTabLabelActive]}>From</Text>
                        <Text style={[styles.datePickerTabValue, pickingDate === 'start' && styles.datePickerTabValueActive]}>
                          {customStart ? customStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Select'}
                        </Text>
                      </Pressable>
                      <Ionicons name="arrow-forward" size={16} color={colors.textSecondary} />
                      <Pressable
                        onPress={() => setPickingDate('end')}
                        style={[styles.datePickerTab, pickingDate === 'end' && styles.datePickerTabActive]}
                      >
                        <Text style={[styles.datePickerTabLabel, pickingDate === 'end' && styles.datePickerTabLabelActive]}>To</Text>
                        <Text style={[styles.datePickerTabValue, pickingDate === 'end' && styles.datePickerTabValueActive]}>
                          {customEnd ? customEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Select'}
                        </Text>
                      </Pressable>
                    </View>

                    <View style={styles.calendarNav}>
                      <Pressable onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>
                        <Ionicons name="chevron-back" size={22} color={colors.text} />
                      </Pressable>
                      <Text style={styles.calendarMonthLabel}>
                        {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </Text>
                      <Pressable onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>
                        <Ionicons name="chevron-forward" size={22} color={colors.text} />
                      </Pressable>
                    </View>

                    <View style={styles.calendarDayHeaders}>
                      {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
                        <Text key={d} style={styles.calendarDayHeader}>{d}</Text>
                      ))}
                    </View>

                    <View style={styles.calendarGrid}>
                      {(() => {
                        const year = calendarMonth.getFullYear();
                        const month = calendarMonth.getMonth();
                        const firstDay = new Date(year, month, 1);
                        const lastDay = new Date(year, month + 1, 0);
                        const startOffset = (firstDay.getDay() + 6) % 7;
                        const days: (Date | null)[] = [];
                        for (let i = 0; i < startOffset; i++) days.push(null);
                        for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
                        while (days.length % 7 !== 0) days.push(null);

                        const today = new Date();
                        today.setHours(0, 0, 0, 0);

                        return days.map((day, i) => {
                          if (!day) return <View key={`e${i}`} style={styles.calendarCell} />;

                          const isFuture = day > today;
                          const isStart = customStart && day.toDateString() === customStart.toDateString();
                          const isEnd = customEnd && day.toDateString() === customEnd.toDateString();
                          const isInRange = customStart && customEnd && day >= customStart && day <= customEnd;

                          return (
                            <Pressable
                              key={day.toISOString()}
                              disabled={isFuture}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                if (isStart) {
                                  setCustomStart(null);
                                  setPickingDate('start');
                                  return;
                                }
                                if (isEnd) {
                                  setCustomEnd(null);
                                  setPickingDate('end');
                                  return;
                                }
                                if (pickingDate === 'start') {
                                  setCustomStart(day);
                                  if (customEnd && day > customEnd) setCustomEnd(null);
                                  setPickingDate('end');
                                } else {
                                  if (customStart && day < customStart) {
                                    setCustomStart(day);
                                    setCustomEnd(null);
                                    setPickingDate('end');
                                  } else {
                                    setCustomEnd(day);
                                  }
                                }
                              }}
                              style={[
                                styles.calendarCell,
                                isInRange && !isStart && !isEnd && styles.calendarCellInRange,
                                (isStart || isEnd) && styles.calendarCellSelected,
                              ]}
                            >
                              <Text style={[
                                styles.calendarCellText,
                                isFuture && { color: colors.textSecondary + '40' },
                                isInRange && !isStart && !isEnd && styles.calendarCellTextInRange,
                                (isStart || isEnd) && styles.calendarCellTextSelected,
                              ]}>
                                {day.getDate()}
                              </Text>
                            </Pressable>
                          );
                        });
                      })()}
                    </View>
                  </View>
                )}

                <Pressable
                  onPress={handleExport}
                  disabled={exporting || (exportRange === 'custom' && (!customStart || !customEnd))}
                  style={({ pressed }) => [
                    styles.exportBtn,
                    pressed && { opacity: 0.9 },
                    (exporting || (exportRange === 'custom' && (!customStart || !customEnd))) && { opacity: 0.5 },
                  ]}
                >
                  {exporting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="document-text-outline" size={20} color="#fff" />
                      <Text style={styles.exportBtnText}>Export CSV</Text>
                    </>
                  )}
                </Pressable>

                <Pressable onPress={() => setShowExportModal(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Modal>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenTitle: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: colors.text,
  },
  downloadBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
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
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary,
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
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  periodCardExpanded: {
    borderColor: colors.primary + '40',
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
    color: colors.text,
  },
  periodLabelCurrent: {
    color: colors.primary,
  },
  periodSublabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    marginTop: 1,
  },
  currentBadge: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  currentBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: colors.primary,
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
    color: colors.text,
  },
  periodMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  periodCount: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
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
    color: colors.textSecondary,
  },
  filteredBar: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 4,
  },
  filteredText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyContainer: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 32,
    marginHorizontal: 16,
    marginTop: 20,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: colors.text,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    marginBottom: 20,
  },
  rangeOptions: {
    gap: 8,
    marginBottom: 24,
  },
  rangeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  rangeOptionActive: {
    borderColor: colors.primary + '60',
    backgroundColor: colors.primary + '08',
  },
  rangeOptionText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: colors.text,
  },
  rangeOptionTextActive: {
    color: colors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  customRangeLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.primary,
    marginTop: 2,
  },
  calendarSection: {
    marginBottom: 20,
  },
  datePickerTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  datePickerTab: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  datePickerTabActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '08',
  },
  datePickerTabLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  datePickerTabLabelActive: {
    color: colors.primary,
  },
  datePickerTabValue: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
    marginTop: 2,
  },
  datePickerTabValueActive: {
    color: colors.primary,
  },
  calendarNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  calendarMonthLabel: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
  },
  calendarDayHeaders: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  calendarDayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
    paddingVertical: 4,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: '14.285%',
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarCellInRange: {
    backgroundColor: colors.primary + '12',
  },
  calendarCellSelected: {
    backgroundColor: colors.primary,
    borderRadius: 21,
  },
  calendarCellText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.text,
  },
  calendarCellTextInRange: {
    color: colors.primary,
  },
  calendarCellTextSelected: {
    color: '#fff',
    fontFamily: 'Inter_700Bold',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 52,
    marginBottom: 10,
  },
  exportBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
  },
});
