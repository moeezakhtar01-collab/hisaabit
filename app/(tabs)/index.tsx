import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { router, useNavigation } from 'expo-router';
import { useColors } from '@/lib/theme-context';
import type { ThemeColors } from '@/constants/colors';
import SpendingChart from '@/components/SpendingChart';
import WeeklyOverview from '@/components/WeeklyOverview';
import AnimatedAmount from '@/components/AnimatedAmount';
import {
  Expense,
  MonthlyBudget,
  getExpenses,
  getExpensesForMonth,
  getExpensesForWeek,
  getExpensesForToday,
  getMonthKey,
  getMonthLabel,
  getMonthlyBudget,
  formatPKR,
  getTotalExpenses,
} from '@/lib/storage';
import { getPendingCount } from '@/lib/sms-storage';

type PeriodTab = 'monthly' | 'weekly' | 'daily';

export default function HomeScreen() {
  const colors = useColors();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [monthlyBudget, setMonthlyBudgetState] = useState<MonthlyBudget | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<PeriodTab>('monthly');
  const [smsPendingCount, setSmsPendingCount] = useState(0);
  const currentMonth = getMonthKey();

  const loadExpenses = useCallback(async () => {
    const [all, mb, pendingCt] = await Promise.all([
      getExpenses(),
      getMonthlyBudget(currentMonth),
      getPendingCount(),
    ]);
    setExpenses(all);
    setMonthlyBudgetState(mb);
    setSmsPendingCount(pendingCt);
  }, [currentMonth]);

  const navigation = useNavigation();

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  useEffect(() => {
    return navigation.addListener('focus', () => {
      loadExpenses();
    });
  }, [navigation, loadExpenses]);

  useEffect(() => {
    const interval = setInterval(loadExpenses, 30000);
    return () => clearInterval(interval);
  }, [loadExpenses]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadExpenses();
    setRefreshing(false);
  }, [loadExpenses]);

  const monthExpenses = getExpensesForMonth(expenses, currentMonth);
  const totalThisMonth = getTotalExpenses(monthExpenses);
  const todayTotal = getTotalExpenses(getExpensesForToday(expenses));

  const chartExpenses = useMemo(() => {
    switch (chartPeriod) {
      case 'monthly': return getExpensesForMonth(expenses, currentMonth);
      case 'weekly': return getExpensesForWeek(expenses);
      case 'daily': return getExpensesForToday(expenses);
    }
  }, [expenses, chartPeriod, currentMonth]);

  const chartPeriodLabel = chartPeriod === 'monthly' ? 'Month' : chartPeriod === 'weekly' ? 'Week' : 'Day';

  const handleChartPeriodChange = (tab: PeriodTab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setChartPeriod(tab);
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
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 12 }]}>
          <View>
            <Text style={styles.appName}><Text style={{ color: colors.primary }}>Hisaab</Text><Text style={{ color: colors.accent }}>it</Text></Text>
            <Text style={styles.monthLabel}>{getMonthLabel(currentMonth)}</Text>
          </View>
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
            <View style={[styles.summaryIconBg, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="calendar" size={18} color={colors.primary} />
            </View>
            <Text style={styles.summaryLabel}>Spent This Month</Text>
            <AnimatedAmount value={totalThisMonth} formatter={formatPKR} style={styles.summaryAmount} />
          </View>
          {monthlyBudget && monthlyBudget.totalLimit > 0 ? (
            <View style={styles.summaryCard}>
              <View style={[styles.summaryIconBg, {
                backgroundColor: (monthlyBudget.totalLimit - totalThisMonth >= 0 ? colors.success : colors.danger) + '15'
              }]}>
                <Ionicons
                  name="wallet"
                  size={18}
                  color={monthlyBudget.totalLimit - totalThisMonth >= 0 ? colors.success : colors.danger}
                />
              </View>
              <Text style={styles.summaryLabel}>
                {monthlyBudget.totalLimit - totalThisMonth >= 0 ? 'Remaining' : 'Over Budget'}
              </Text>
              <AnimatedAmount
                value={Math.abs(monthlyBudget.totalLimit - totalThisMonth)}
                formatter={formatPKR}
                style={[
                  styles.summaryAmount,
                  { color: monthlyBudget.totalLimit - totalThisMonth >= 0 ? colors.success : colors.danger },
                ]}
              />
            </View>
          ) : (
            <View style={styles.summaryCard}>
              <View style={[styles.summaryIconBg, { backgroundColor: colors.accent + '20' }]}>
                <Ionicons name="today" size={18} color={colors.accent} />
              </View>
              <Text style={styles.summaryLabel}>Today</Text>
              <AnimatedAmount value={todayTotal} formatter={formatPKR} style={styles.summaryAmount} />
            </View>
          )}
        </Animated.View>

        {smsPendingCount > 0 && (
          <Animated.View entering={FadeInDown.delay(125).duration(400)}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                (router as any).push('/sms-expenses');
              }}
              style={({ pressed }) => [
                styles.smsBanner,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
            >
              <View style={styles.smsBannerIcon}>
                <Ionicons name="mail-unread" size={18} color={colors.warning} />
              </View>
              <View style={styles.smsBannerText}>
                <Text style={styles.smsBannerTitle}>
                  {smsPendingCount} SMS expense{smsPendingCount > 1 ? 's' : ''} detected
                </Text>
                <Text style={styles.smsBannerSubtitle}>Tap to review</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(150).duration(500)}>
          <WeeklyOverview expenses={expenses} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(175).duration(500)}>
          {new Date().getDay() === 0 ? (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                (router as any).push('/weekly-report');
              }}
              style={({ pressed }) => [
                styles.reportBanner,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
            >
              <View style={styles.reportBannerLeft}>
                <Text style={styles.reportBannerEmoji}>{'\u2728'}</Text>
                <View>
                  <Text style={styles.reportBannerTitle}>Your Weekly Hisaab is ready</Text>
                  <Text style={styles.reportBannerSub}>Tap to see your spending story</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />
            </Pressable>
          ) : (
            <View style={[styles.reportBanner, { opacity: 0.6 }]}>
              <View style={styles.reportBannerLeft}>
                <Text style={styles.reportBannerEmoji}>{'\uD83D\uDCC5'}</Text>
                <View>
                  <Text style={styles.reportBannerTitle}>Weekly Hisaab</Text>
                  <Text style={styles.reportBannerSub}>Available on Sunday</Text>
                </View>
              </View>
              <Ionicons name="lock-closed" size={16} color="rgba(255,255,255,0.3)" />
            </View>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(225).duration(500)}>
          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>Spending Breakdown</Text>
            <View style={styles.chartTabBar}>
              {(['monthly', 'weekly', 'daily'] as PeriodTab[]).map(tab => (
                <Pressable
                  key={tab}
                  onPress={() => handleChartPeriodChange(tab)}
                  style={[styles.chartTab, chartPeriod === tab && styles.chartTabActive]}
                >
                  <Text style={[styles.chartTabText, chartPeriod === tab && styles.chartTabTextActive]}>
                    {tab === 'monthly' ? 'Monthly' : tab === 'weekly' ? 'Weekly' : 'Daily'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <SpendingChart expenses={chartExpenses} periodLabel={chartPeriodLabel} key={chartPeriod} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(275).duration(500)}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/history');
            }}
            style={({ pressed }) => [styles.viewDetailsBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
          >
            <View style={styles.viewDetailsLeft}>
              <Ionicons name="receipt-outline" size={20} color={colors.primary} />
              <Text style={styles.viewDetailsText}>View Expense Details</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
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
  appName: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: colors.text,
  },
  monthLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  plusBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
  },
  headerBtnAccent: {
    backgroundColor: colors.accent,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.textSecondary,
  },
  summaryAmount: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: colors.text,
  },
  chartSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: colors.text,
    flexShrink: 1,
  },
  chartTabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 2,
    flexShrink: 0,
  },
  chartTab: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  chartTabActive: {
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  chartTabText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textSecondary,
  },
  chartTabTextActive: {
    color: colors.primary,
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  viewDetailsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  viewDetailsText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
  },
  reportBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
  },
  reportBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reportBannerEmoji: {
    fontSize: 24,
  },
  reportBannerTitle: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  reportBannerSub: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  smsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '10',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.warning + '30',
    gap: 12,
  },
  smsBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.warning + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smsBannerText: {
    flex: 1,
    gap: 1,
  },
  smsBannerTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
  },
  smsBannerSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
});
