import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  RefreshControl,
} from 'react-native';
import { AD_BANNER_ID, ADS_AVAILABLE, getBannerAdComponent, getBannerAdSize, getTestIds } from '@/lib/ad-manager';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useColors } from '@/lib/theme-context';
import type { ThemeColors } from '@/constants/colors';
import { useAuth } from '@/lib/auth-context';
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
import { SMS_ENABLED } from '@/lib/feature-flags';

type PeriodTab = 'monthly' | 'weekly' | 'daily';

export default function HomeScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [monthlyBudget, setMonthlyBudgetState] = useState<MonthlyBudget | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // True until the very first load (success or fail) completes. Used
  // to show skeleton placeholders instead of misleading "Rs. 0" or
  // "Welcome to Hisaabit" empty-state UI on cold start while the
  // expense list is still in flight.
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<PeriodTab>('monthly');
  const [smsPendingCount, setSmsPendingCount] = useState(0);
  const currentMonth = getMonthKey();

  const loadExpenses = useCallback(async () => {
    try {
      const [all, mb, pendingCt] = await Promise.all([
        getExpenses(),
        getMonthlyBudget(currentMonth),
        SMS_ENABLED ? getPendingCount() : Promise.resolve(0),
      ]);
      setExpenses(all);
      setMonthlyBudgetState(mb);
      setSmsPendingCount(pendingCt);
      setLoadError(null);
    } catch (err: any) {
      setLoadError(err?.message || 'Couldn’t load your data.');
    } finally {
      setIsInitialLoad(false);
    }
  }, [currentMonth]);

  // Refresh on focus + on pull-to-refresh. The previous 30s background
  // polling was burning battery + data on idle tabs. useFocusEffect
  // already covers tab switches and screen returns.
  useFocusEffect(
    useCallback(() => {
      loadExpenses();
    }, [loadExpenses])
  );

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
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/voice-expense');
              }}
              style={({ pressed }) => [styles.voicePill, pressed && { opacity: 0.9, transform: [{ scale: 0.96 }] }]}
              testID="add-voice"
              accessibilityLabel="Record voice expense"
            >
              <Ionicons name="mic" size={18} color="#fff" />
              <Text style={styles.voicePillText}>Voice</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/add-expense');
              }}
              style={({ pressed }) => [styles.manualBtn, pressed && { opacity: 0.7, transform: [{ scale: 0.92 }] }]}
              testID="add-manual"
              accessibilityLabel="Type expense manually"
            >
              <Ionicons name="add" size={22} color={colors.primary} />
            </Pressable>
          </View>
        </View>

        {loadError ? (
          <View style={styles.errorBanner}>
            <Ionicons name="cloud-offline-outline" size={18} color={colors.danger} />
            <Text style={styles.errorBannerText} numberOfLines={2}>{loadError}</Text>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                loadExpenses();
              }}
              style={({ pressed }) => [styles.errorBannerBtn, pressed && { opacity: 0.7 }]}
              testID="home-error-retry"
            >
              <Text style={styles.errorBannerBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryIconBg, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="calendar" size={18} color={colors.primary} />
            </View>
            <Text style={styles.summaryLabel} numberOfLines={1}>Spent This Month</Text>
            {isInitialLoad ? (
              <View style={styles.summaryAmountSkeleton} />
            ) : (
              <AnimatedAmount value={totalThisMonth} formatter={formatPKR} style={styles.summaryAmount} />
            )}
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
              <Text style={styles.summaryLabel} numberOfLines={1}>
                {monthlyBudget.totalLimit - totalThisMonth >= 0 ? 'Left This Month' : 'Over Budget'}
              </Text>
              {isInitialLoad ? (
                <View style={styles.summaryAmountSkeleton} />
              ) : (
                <AnimatedAmount
                  value={Math.abs(monthlyBudget.totalLimit - totalThisMonth)}
                  formatter={formatPKR}
                  style={[
                    styles.summaryAmount,
                    { color: monthlyBudget.totalLimit - totalThisMonth >= 0 ? colors.success : colors.danger },
                  ]}
                />
              )}
            </View>
          ) : (
            <View style={styles.summaryCard}>
              <View style={[styles.summaryIconBg, { backgroundColor: colors.accent + '20' }]}>
                <Ionicons name="today" size={18} color={colors.accent} />
              </View>
              <Text style={styles.summaryLabel} numberOfLines={1}>Today</Text>
              {isInitialLoad ? (
                <View style={styles.summaryAmountSkeleton} />
              ) : (
                <AnimatedAmount value={todayTotal} formatter={formatPKR} style={styles.summaryAmount} />
              )}
            </View>
          )}
        </Animated.View>

        {!isInitialLoad && expenses.length === 0 && (
          <Animated.View entering={FadeInDown.delay(110).duration(500)} style={styles.welcomeCard}>
            <View style={styles.welcomeIconBg}>
              <Ionicons name="sparkles" size={22} color={colors.primary} />
            </View>
            <Text style={styles.welcomeTitle}>Welcome to Hisaabit</Text>
            <Text style={styles.welcomeSubtitle}>
              Start tracking your daily kharcha in seconds.
            </Text>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/voice-expense');
              }}
              style={({ pressed }) => [styles.welcomePrimaryBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
              testID="welcome-add-voice"
            >
              <Ionicons name="mic" size={20} color="#fff" />
              <Text style={styles.welcomePrimaryBtnText}>Try voice expense</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/add-expense');
              }}
              style={({ pressed }) => [styles.welcomeSecondaryBtn, pressed && { opacity: 0.7 }]}
              testID="welcome-add-manual"
            >
              <Text style={styles.welcomeSecondaryBtnText}>Or type it manually</Text>
            </Pressable>
          </Animated.View>
        )}

        {SMS_ENABLED && smsPendingCount > 0 && (
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
          {(() => {
            const dayOfWeek = new Date().getDay();
            const isSunday = dayOfWeek === 0;
            const daysUntilSunday = isSunday ? 0 : 7 - dayOfWeek;
            const subtitle = isSunday
              ? 'Tap to see your weekly summary'
              : daysUntilSunday === 1
                ? 'Available tomorrow'
                : `Available in ${daysUntilSunday} days`;
            const content = (
              <>
                <View style={styles.reportBannerLeft}>
                  <Text style={styles.reportBannerEmoji}>{isSunday ? '\u2728' : '\uD83D\uDCC5'}</Text>
                  <View style={styles.reportBannerTextWrap}>
                    <Text style={styles.reportBannerTitle} numberOfLines={1}>Weekly Hisaab</Text>
                    <Text style={styles.reportBannerSub} numberOfLines={1}>{subtitle}</Text>
                  </View>
                </View>
                {isSunday ? (
                  <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.6)" style={styles.reportBannerChevron} />
                ) : (
                  <Ionicons name="lock-closed" size={16} color="rgba(255,255,255,0.45)" style={styles.reportBannerChevron} />
                )}
              </>
            );
            return isSunday ? (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  (router as any).push('/weekly-report');
                }}
                style={({ pressed }) => [
                  styles.reportBanner,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                ]}
                testID="weekly-hisaab-banner"
              >
                {content}
              </Pressable>
            ) : (
              <View
                style={[styles.reportBanner, styles.reportBannerMuted]}
                testID="weekly-hisaab-banner"
              >
                {content}
              </View>
            );
          })()}
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

        {!user?.adsRemoved && Platform.OS !== 'web' && ADS_AVAILABLE && (() => {
          const BannerAd = getBannerAdComponent();
          const BannerAdSize = getBannerAdSize();
          const TestIds = getTestIds();
          if (!BannerAd || !BannerAdSize) return null;
          return (
            <View style={styles.adBanner}>
              <BannerAd
                unitId={__DEV__ ? TestIds.ADAPTIVE_BANNER : AD_BANNER_ID}
                size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
                requestOptions={{ requestNonPersonalizedAdsOnly: true }}
                onAdFailedToLoad={() => {}}
              />
            </View>
          );
        })()}
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
    alignItems: 'center',
    gap: 8,
  },
  voicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  voicePillText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  manualBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary + '12',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: colors.primary + '30',
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
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: colors.text,
  },
  chartTabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 2,
    alignSelf: 'flex-start',
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
  adBanner: {
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
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
  reportBannerMuted: {
    backgroundColor: colors.primaryDark,
    opacity: 0.85,
  },
  reportBannerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginRight: 8,
  },
  reportBannerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  reportBannerEmoji: {
    fontSize: 24,
    lineHeight: 28,
  },
  reportBannerChevron: {
    flexShrink: 0,
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
  welcomeCard: {
    backgroundColor: colors.primary + '08',
    borderRadius: 16,
    padding: 18,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.primary + '22',
    alignItems: 'center',
    gap: 10,
  },
  welcomeIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: colors.text,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 4,
  },
  welcomePrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 8,
    alignSelf: 'stretch',
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  welcomePrimaryBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  welcomeSecondaryBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  welcomeSecondaryBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.primary,
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
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.danger + '12',
    borderColor: colors.danger + '30',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: colors.danger,
  },
  errorBannerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.danger,
  },
  errorBannerBtnText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  summaryAmountSkeleton: {
    height: 22,
    width: '70%',
    backgroundColor: colors.surface,
    borderRadius: 6,
    opacity: 0.7,
    marginTop: 2,
  },
});
