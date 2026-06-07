import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useColors } from '@/lib/theme-context';
import type { ThemeColors } from '@/constants/colors';
import { getExpenses, getCategoryIcon, formatPKR, type Expense } from '@/lib/storage';
import { computeWeeklySummary, type WeeklySummary } from '@/lib/weekly-report';

/**
 * v2 Weekly Hisaab — a single, seamless, informative screen (replaces the old
 * 8-slide Spotify-style story). No staggered text animations. Built
 * category-agnostic so AI-created categories render correctly.
 */
export default function WeeklyReportScreen() {
  const colors = useColors();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();

  const [expenses, setExpenses] = useState<Expense[] | null>(null);

  useEffect(() => {
    getExpenses().then(setExpenses).catch(() => setExpenses([]));
  }, []);

  const summary = useMemo<WeeklySummary | null>(
    () => (expenses ? computeWeeklySummary(expenses) : null),
    [expenses],
  );

  const close = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (router.canGoBack()) router.back();
    else router.replace('/dashboard' as any);
  }, []);

  const insights = useMemo(() => (summary ? buildInsights(summary) : []), [summary]);
  const maxDay = summary ? Math.max(...summary.days.map((d) => d.amount), 1) : 1;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={close} hitSlop={12} style={styles.closeBtn} testID="weekly-close">
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Weekly Hisaab</Text>
          {summary && <Text style={styles.headerSub}>{summary.weekLabel}</Text>}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {!summary ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : summary.txCount === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="sparkles-outline" size={28} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No spending captured yet</Text>
          <Text style={styles.emptyBody}>
            Once transactions start coming in this week, your summary will build itself here.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>Total spent this week</Text>
            <Text style={styles.heroAmount} adjustsFontSizeToFit numberOfLines={1}>{formatPKR(summary.total)}</Text>
            <DeltaPill summary={summary} colors={colors} />
            {summary.moneyIn > 0 && (
              <Text style={styles.heroIn}>+ {formatPKR(summary.moneyIn)} came in this week</Text>
            )}
          </View>

          {/* Quick stats */}
          <View style={styles.statRow}>
            <Stat colors={colors} label="Transactions" value={String(summary.txCount)} />
            <View style={styles.statDivider} />
            <Stat colors={colors} label="Avg / active day" value={formatPKR(summary.avgPerActiveDay)} />
            <View style={styles.statDivider} />
            <Stat colors={colors} label="No-spend days" value={String(summary.noSpendDays)} />
          </View>

          {/* Daily bars */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Day by day</Text>
            <View style={styles.bars}>
              {summary.days.map((d) => {
                const h = Math.max(4, Math.round((d.amount / maxDay) * 96));
                return (
                  <View key={d.key} style={styles.barCol}>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { height: h, backgroundColor: d.isToday ? colors.primary : colors.primary + '40' },
                        ]}
                      />
                    </View>
                    <Text style={[styles.barLabel, d.isToday && { color: colors.primary, fontFamily: 'Inter_700Bold' }]}>
                      {d.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Smart insights */}
          {insights.length > 0 && (
            <View style={styles.insights}>
              <Text style={styles.sectionTitle}>Insights</Text>
              {insights.map((ins, i) => (
                <View key={i} style={styles.insightRow}>
                  <View style={[styles.insightIcon, { backgroundColor: toneColor(ins.tone, colors) + '1A' }]}>
                    <Ionicons name={ins.icon as any} size={16} color={toneColor(ins.tone, colors)} />
                  </View>
                  <Text style={styles.insightText}>{ins.text}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Category breakdown */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Where it went</Text>
            <View style={{ gap: 14, marginTop: 8 }}>
              {summary.categories.map((c) => {
                const color = categoryColor(c.key, colors);
                return (
                  <View key={c.key} style={styles.catRow}>
                    <View style={[styles.catIcon, { backgroundColor: color + '1A' }]}>
                      <Ionicons name={getCategoryIcon(c.key) as any} size={16} color={color} />
                    </View>
                    <View style={styles.catBody}>
                      <View style={styles.catTop}>
                        <Text style={styles.catLabel} numberOfLines={1}>{c.label}</Text>
                        <Text style={styles.catAmount}>{formatPKR(c.amount)}</Text>
                      </View>
                      <View style={styles.catBarTrack}>
                        <View style={[styles.catBarFill, { width: `${Math.max(3, c.pct)}%`, backgroundColor: color }]} />
                      </View>
                    </View>
                    <Text style={styles.catPct}>{c.pct}%</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ─── Insights ────────────────────────────────────────────────────

type Insight = { icon: string; text: string; tone: 'up' | 'down' | 'neutral' };

function buildInsights(s: WeeklySummary): Insight[] {
  const out: Insight[] = [];
  if (s.txCount === 0) return out;

  if (s.hasLastWeek) {
    if (s.deltaPct > 5) {
      out.push({ icon: 'trending-up', tone: 'up', text: `You spent ${Math.abs(s.deltaPct)}% more than last week — ${formatPKR(s.lastWeekTotal)} → ${formatPKR(s.total)}.` });
    } else if (s.deltaPct < -5) {
      out.push({ icon: 'trending-down', tone: 'down', text: `Down ${Math.abs(s.deltaPct)}% from last week — ${formatPKR(s.lastWeekTotal)} → ${formatPKR(s.total)}. Nice.` });
    } else {
      out.push({ icon: 'swap-horizontal', tone: 'neutral', text: `About the same as last week (${formatPKR(s.total)}).` });
    }
  }
  if (s.categories[0] && s.categories[0].pct >= 25) {
    out.push({ icon: 'pie-chart', tone: 'neutral', text: `${s.categories[0].label} was your biggest area — ${formatPKR(s.categories[0].amount)} (${s.categories[0].pct}%).` });
  }
  if (s.biggest) {
    out.push({ icon: 'arrow-up-circle', tone: 'neutral', text: `Biggest single expense: ${formatPKR(s.biggest.amount)} on ${s.biggest.note}.` });
  }
  if (s.busiest) {
    out.push({ icon: 'calendar', tone: 'neutral', text: `${dayFull(s.busiest.label)} was your heaviest day at ${formatPKR(s.busiest.amount)}.` });
  }
  if (s.noSpendDays >= 2) {
    out.push({ icon: 'leaf', tone: 'down', text: `${s.noSpendDays} no-spend days this week.` });
  }
  return out.slice(0, 4);
}

function dayFull(short: string): string {
  const map: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
  return map[short] || short;
}

function toneColor(tone: Insight['tone'], colors: ThemeColors): string {
  if (tone === 'up') return colors.danger;
  if (tone === 'down') return colors.success;
  return colors.primary;
}

// Dynamic-ready: known category → its palette color; AI-created category →
// a stable color derived from the key.
function categoryColor(key: string, colors: ThemeColors): string {
  const known = (colors.categories as any)[key];
  if (known) return known;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 52%, 52%)`;
}

// ─── Small components ────────────────────────────────────────────

function DeltaPill({ summary, colors }: { summary: WeeklySummary; colors: ThemeColors }) {
  const styles = createStyles(colors);
  if (!summary.hasLastWeek) {
    return <Text style={styles.deltaNeutralText}>First week of tracking</Text>;
  }
  const up = summary.deltaPct > 0;
  const flat = Math.abs(summary.deltaPct) <= 5;
  const tone = flat ? colors.textSecondary : up ? colors.danger : colors.success;
  return (
    <View style={[styles.deltaPill, { backgroundColor: tone + '18' }]}>
      <Ionicons name={flat ? 'remove' : up ? 'arrow-up' : 'arrow-down'} size={14} color={tone} />
      <Text style={[styles.deltaText, { color: tone }]}>
        {flat ? 'about the same as last week' : `${Math.abs(summary.deltaPct)}% ${up ? 'more' : 'less'} than last week`}
      </Text>
    </View>
  );
}

function Stat({ colors, label, value }: { colors: ThemeColors; label: string; value: string }) {
  const styles = createStyles(colors);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  closeBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: colors.text },
  headerSub: { fontSize: 12, fontFamily: 'Inter_500Medium', color: colors.textSecondary, marginTop: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary + '14', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: colors.text },
  emptyBody: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular', color: colors.textSecondary, textAlign: 'center', maxWidth: 300 },
  content: { padding: 16, gap: 16 },
  hero: {
    backgroundColor: colors.card, borderRadius: 20, padding: 24, alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  heroLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 },
  heroAmount: { fontSize: 42, fontFamily: 'Inter_700Bold', color: colors.text },
  heroIn: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.success, marginTop: 6 },
  deltaPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginTop: 2 },
  deltaText: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold' },
  deltaNeutralText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.textSecondary, marginTop: 2 },
  statRow: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingVertical: 16 },
  stat: { flex: 1, alignItems: 'center', gap: 3, paddingHorizontal: 6 },
  statValue: { fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.text },
  statLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' },
  statDivider: { width: 1, backgroundColor: colors.border, marginVertical: 6 },
  card: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 },
  cardTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: colors.text },
  bars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 124, marginTop: 14 },
  barCol: { flex: 1, alignItems: 'center', gap: 8 },
  barTrack: { height: 96, justifyContent: 'flex-end' },
  barFill: { width: 22, borderRadius: 6 },
  barLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: colors.textSecondary },
  insights: { gap: 8 },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: colors.text, paddingHorizontal: 4, marginBottom: 2 },
  insightRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14,
  },
  insightIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  insightText: { flex: 1, fontSize: 13.5, lineHeight: 19, fontFamily: 'Inter_500Medium', color: colors.text },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  catIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  catBody: { flex: 1, gap: 5 },
  catTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catLabel: { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.text },
  catAmount: { fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.text },
  catBarTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surface, overflow: 'hidden' },
  catBarFill: { height: '100%', borderRadius: 3 },
  catPct: { width: 38, textAlign: 'right', fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.textSecondary },
});
