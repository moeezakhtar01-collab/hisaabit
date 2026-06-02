import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  RefreshControl,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useColors } from '@/lib/theme-context';
import type { ThemeColors } from '@/constants/colors';
import {
  Expense,
  getExpenses,
  getExpensesForWeek,
  getTotalExpenses,
  getWeekDateRange,
  formatPKR,
  formatDate,
  getCategoryLabel,
  getCategoryIcon,
} from '@/lib/storage';
import { hasNotificationAccess } from '@/lib/notification-listener';
import { flushCaptureQueue } from '@/lib/notification-task';

/**
 * v2 home — the silent tracker's single screen. Leads with "spent this week"
 * (computed from auto-captured expenses), shows tracking status, the weekly
 * summary entry, and a trust feed of recently caught transactions. No manual
 * entry anywhere.
 */
export default function DashboardScreen() {
  const colors = useColors();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const isAndroid = Platform.OS === 'android';

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const appState = useRef(AppState.currentState);

  const load = useCallback(async () => {
    try {
      flushCaptureQueue().catch(() => {}); // retry any captures queued while offline
      const [all, access] = await Promise.all([getExpenses(), hasNotificationAccess()]);
      setExpenses(all);
      setHasAccess(access);
    } catch {
      // keep last good state; the feed just won't update
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') load();
      appState.current = next;
    });
    return () => sub.remove();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const week = getWeekDateRange();
  const weekExpenses = getExpensesForWeek(expenses);
  const weekTotal = getTotalExpenses(weekExpenses);
  const recent = weekExpenses.slice(0, 8);

  const trackingOn = isAndroid ? hasAccess : true;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.wordmark}>
          <Text style={{ color: colors.primary }}>Hisaab</Text>
          <Text style={{ color: colors.accent }}>it</Text>
        </Text>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/notification-settings'); }}
          style={({ pressed }) => [styles.gear, pressed && { opacity: 0.6 }]}
          hitSlop={10}
          testID="dashboard-settings"
        >
          <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Tracking status */}
        <Animated.View entering={FadeInDown.delay(60).duration(450)}>
          <Pressable
            disabled={trackingOn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/onboarding' as any); }}
            style={[styles.statusPill, { backgroundColor: (trackingOn ? colors.success : colors.warning) + '14' }]}
          >
            <View style={[styles.statusDot, { backgroundColor: trackingOn ? colors.success : colors.warning }]} />
            <Text style={[styles.statusText, { color: trackingOn ? colors.success : colors.warning }]}>
              {trackingOn ? 'Listening for your spending' : 'Tracking is off — tap to turn on'}
            </Text>
            {!trackingOn && <Ionicons name="chevron-forward" size={15} color={colors.warning} />}
          </Pressable>
        </Animated.View>

        {/* Hero: spent this week */}
        <Animated.View entering={FadeInDown.delay(120).duration(450)} style={styles.hero}>
          <Text style={styles.heroLabel}>Spent this week</Text>
          <Text style={styles.heroAmount} adjustsFontSizeToFit numberOfLines={1}>{formatPKR(weekTotal)}</Text>
          <Text style={styles.heroSub}>
            {week.label}  ·  {weekExpenses.length} {weekExpenses.length === 1 ? 'transaction' : 'transactions'} caught
          </Text>
        </Animated.View>

        {/* Weekly summary entry (the payoff) */}
        <Animated.View entering={FadeInDown.delay(180).duration(450)}>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); (router as any).push('/weekly-report'); }}
            style={({ pressed }) => [styles.summaryCard, pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] }]}
            testID="dashboard-weekly"
          >
            <Text style={styles.summaryEmoji}>✨</Text>
            <View style={styles.summaryText}>
              <Text style={styles.summaryTitle}>Your weekly Hisaab</Text>
              <Text style={styles.summarySub}>See where your money went this week</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
          </Pressable>
        </Animated.View>

        {/* Recent captures (trust feed) */}
        <Animated.View entering={FadeInDown.delay(240).duration(450)} style={styles.feedSection}>
          <Text style={styles.feedTitle}>Recently caught</Text>

          {loading ? (
            <View style={styles.feedCard}>
              {[0, 1, 2].map(i => (
                <View key={i} style={[styles.row, i > 0 && styles.rowBorder]}>
                  <View style={styles.skelIcon} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={[styles.skelBar, { width: '55%' }]} />
                    <View style={[styles.skelBar, { width: '30%' }]} />
                  </View>
                  <View style={[styles.skelBar, { width: 54 }]} />
                </View>
              ))}
            </View>
          ) : recent.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="radio-outline" size={26} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Nothing caught yet</Text>
              <Text style={styles.emptyBody}>
                {trackingOn
                  ? 'Spend something with your card or wallet and it’ll appear here automatically — no typing needed.'
                  : 'Turn on tracking and your spending will start showing up here on its own.'}
              </Text>
            </View>
          ) : (
            <View style={styles.feedCard}>
              {recent.map((e, i) => (
                <View key={e.id} style={[styles.row, i > 0 && styles.rowBorder]}>
                  <View style={[styles.rowIcon, { backgroundColor: ((colors.categories as any)[e.category] || colors.primary) + '1A' }]}>
                    <Ionicons name={getCategoryIcon(e.category) as any} size={18} color={(colors.categories as any)[e.category] || colors.primary} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowNote} numberOfLines={1}>{e.note?.trim() || getCategoryLabel(e.category)}</Text>
                    <Text style={styles.rowMeta}>{getCategoryLabel(e.category)} · {formatDate(e.date)}</Text>
                  </View>
                  <Text style={styles.rowAmount}>{formatPKR(e.amount)}</Text>
                </View>
              ))}
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 8,
  },
  wordmark: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  gear: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, gap: 16, paddingTop: 4 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold' },
  hero: {
    backgroundColor: colors.card, borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', gap: 6,
  },
  heroLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 },
  heroAmount: { fontSize: 44, fontFamily: 'Inter_700Bold', color: colors.text, marginVertical: 2 },
  heroSub: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.textSecondary },
  summaryCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.primary, borderRadius: 18, padding: 18,
  },
  summaryEmoji: { fontSize: 26 },
  summaryText: { flex: 1 },
  summaryTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
  summarySub: { fontSize: 12.5, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  feedSection: { gap: 10 },
  feedTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.text, paddingHorizontal: 4 },
  feedCard: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rowIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowNote: { fontSize: 14.5, fontFamily: 'Inter_600SemiBold', color: colors.text },
  rowMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.textSecondary },
  rowAmount: { fontSize: 15, fontFamily: 'Inter_700Bold', color: colors.text },
  empty: {
    backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    padding: 28, alignItems: 'center', gap: 8,
  },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary + '14', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.text },
  emptyBody: { fontSize: 13.5, lineHeight: 20, fontFamily: 'Inter_400Regular', color: colors.textSecondary, textAlign: 'center', maxWidth: 300 },
  skelIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: colors.surface, opacity: 0.7 },
  skelBar: { height: 11, borderRadius: 6, backgroundColor: colors.surface, opacity: 0.7 },
});
