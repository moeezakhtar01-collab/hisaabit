import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/lib/theme-context';
import type { ThemeColors } from '@/constants/colors';
import {
  getExpenses,
  getExpensesForWeek,
  getWeekDateRange,
  sumByDirection,
  categoryBreakdown,
  categoryDisplayLabel,
  getCategoryIcon,
  formatPKR,
  type Expense,
  type CategoryTotal,
} from '@/lib/storage';

/**
 * Account drill-down: one medium (HBL, JazzCash…) → Money Out / Money In →
 * the category breakdown within each. The third level of the hierarchy.
 */
export default function AccountDetailScreen() {
  const colors = useColors();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { label } = useLocalSearchParams<{ label?: string }>();
  const account = label || 'Other';

  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  useEffect(() => {
    getExpenses().then(setExpenses).catch(() => setExpenses([]));
  }, []);

  const data = useMemo(() => {
    if (!expenses) return null;
    const week = getExpensesForWeek(expenses).filter((e) => (e.sourceLabel?.trim() || 'Other') === account);
    return {
      out: sumByDirection(week, 'out'),
      in: sumByDirection(week, 'in'),
      outCats: categoryBreakdown(week, 'out'),
      inCats: categoryBreakdown(week, 'in'),
      count: week.length,
    };
  }, [expenses, account]);

  const weekLabel = getWeekDateRange().label;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} hitSlop={12} style={styles.closeBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{account}</Text>
          <Text style={styles.headerSub}>This week · {weekLabel}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {!data ? (
        <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
          {/* In/Out summary */}
          <View style={styles.flowCard}>
            <View style={styles.flowHalf}>
              <View style={styles.flowDot}><Ionicons name="arrow-up" size={14} color={colors.danger} /></View>
              <Text style={styles.flowLabel}>Money Out</Text>
              <Text style={[styles.flowAmount, { color: colors.danger }]} adjustsFontSizeToFit numberOfLines={1}>{formatPKR(data.out)}</Text>
            </View>
            <View style={styles.flowSep} />
            <View style={styles.flowHalf}>
              <View style={[styles.flowDot, { backgroundColor: colors.success + '1A' }]}><Ionicons name="arrow-down" size={14} color={colors.success} /></View>
              <Text style={styles.flowLabel}>Money In</Text>
              <Text style={[styles.flowAmount, { color: colors.success }]} adjustsFontSizeToFit numberOfLines={1}>{formatPKR(data.in)}</Text>
            </View>
          </View>

          {data.count === 0 && (
            <Text style={styles.emptyNote}>No transactions on {account} this week.</Text>
          )}

          <CategorySection title="Where it went" tone="out" cats={data.outCats} colors={colors} />
          <CategorySection title="Where it came from" tone="in" cats={data.inCats} colors={colors} />
        </ScrollView>
      )}
    </View>
  );
}

function CategorySection({ title, tone, cats, colors }: { title: string; tone: 'out' | 'in'; cats: CategoryTotal[]; colors: ThemeColors }) {
  const styles = createStyles(colors);
  if (cats.length === 0) return null;
  const tint = tone === 'in' ? colors.success : colors.danger;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>
        {cats.map((c, i) => (
          <View key={c.category} style={[styles.row, i > 0 && styles.rowBorder]}>
            <View style={[styles.rowIcon, { backgroundColor: catColor(c.category, colors) + '1A' }]}>
              <Ionicons name={getCategoryIcon(c.category) as any} size={16} color={catColor(c.category, colors)} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel} numberOfLines={1}>{categoryDisplayLabel(c.category)}</Text>
              <Text style={styles.rowSub}>{c.count} {c.count === 1 ? 'transaction' : 'transactions'}</Text>
            </View>
            <Text style={[styles.rowAmount, { color: tint }]}>{tone === 'in' ? '+ ' : '− '}{formatPKR(c.amount)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function catColor(key: string, colors: ThemeColors): string {
  const known = (colors.categories as any)[key];
  if (known) return known;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 52%, 52%)`;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  closeBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: colors.text },
  headerSub: { fontSize: 12, fontFamily: 'Inter_500Medium', color: colors.textSecondary, marginTop: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 16 },
  flowCard: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, paddingVertical: 20 },
  flowHalf: { flex: 1, alignItems: 'center', gap: 6 },
  flowSep: { width: 1, backgroundColor: colors.border, marginVertical: 4 },
  flowDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.danger + '1A', alignItems: 'center', justifyContent: 'center' },
  flowLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  flowAmount: { fontSize: 20, fontFamily: 'Inter_700Bold', paddingHorizontal: 8 },
  emptyNote: { fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.textSecondary, textAlign: 'center', paddingVertical: 12 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: colors.text, paddingHorizontal: 4 },
  card: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 14.5, fontFamily: 'Inter_600SemiBold', color: colors.text },
  rowSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginTop: 1 },
  rowAmount: { fontSize: 14.5, fontFamily: 'Inter_700Bold' },
});
