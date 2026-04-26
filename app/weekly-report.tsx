import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useColors } from '@/lib/theme-context';
import { lightColors } from '@/constants/colors';
import AnimatedAmount from '@/components/AnimatedAmount';
import { Expense, getExpenses, formatPKR, getExpensesForWeek } from '@/lib/storage';
import { computeWeeklyReport, WeeklyReportData } from '@/lib/weekly-report';
import { generateWeeklyPdf } from '@/lib/report-export';

const TOTAL_SCREENS = 6;
const BG = '#0A0A0A';
const TEXT_PRIMARY = '#FFFFFF';
const TEXT_DIM = 'rgba(255,255,255,0.5)';
const TEXT_SOFT = 'rgba(255,255,255,0.7)';

// ─── Accent colours per slide ───────────────────────────────────

function getAccent(index: number, data: WeeklyReportData, colors: typeof lightColors): string {
  const catColor =
    colors.categories[
      data.topCategory?.key as keyof typeof colors.categories
    ] || colors.primary;

  return [
    colors.primary,
    data.weekOverWeekDirection === 'up' ? '#EF4444' : '#10B981',
    catColor,
    '#3B82F6',
    colors.success,
    colors.primary,
  ][index];
}

// ─── Individual slides ──────────────────────────────────────────

function HookSlide({ weekLabel }: { weekLabel: string }) {
  const colors = useColors();
  return (
    <View style={s.center} pointerEvents="box-none">
      <Animated.Text
        entering={FadeInDown.delay(200).duration(600)}
        style={s.hookSmall}
      >
        This was your
      </Animated.Text>
      <Animated.Text
        entering={FadeInDown.delay(400).duration(600)}
        style={s.hookBig}
      >
        Weekly Hisaab
      </Animated.Text>
      <Animated.Text
        entering={FadeIn.delay(800).duration(600)}
        style={[s.hookDate, { color: colors.primary }]}
      >
        {weekLabel}
      </Animated.Text>
      <Animated.Text
        entering={FadeIn.delay(1400).duration(800)}
        style={s.tapHint}
      >
        Tap to continue
      </Animated.Text>
    </View>
  );
}

function TotalSlide({ data }: { data: WeeklyReportData }) {
  const colors = useColors();
  const accent =
    data.weekOverWeekDirection === 'up' ? '#EF4444' : '#10B981';
  const arrow = data.weekOverWeekDirection === 'up' ? 'arrow-up' : 'arrow-down';
  const emoji =
    data.weekOverWeekDirection === 'up'
      ? '\uD83D\uDE2C'
      : data.weekOverWeekDirection === 'down'
        ? '\uD83D\uDC4D'
        : '\uD83D\uDE10';

  return (
    <View style={s.center} pointerEvents="box-none">
      <Animated.Text entering={FadeIn.delay(100).duration(400)} style={s.slideLabel}>
        You spent
      </Animated.Text>
      <Animated.View entering={FadeInDown.delay(300).duration(500)}>
        <AnimatedAmount
          value={data.totalSpent}
          formatter={formatPKR}
          style={s.bigNumber}
          duration={1200}
        />
      </Animated.View>
      {data.hasLastWeekData && data.weekOverWeekDirection !== 'same' && (
        <Animated.View
          entering={FadeIn.delay(1000).duration(500)}
          style={[s.badge, { backgroundColor: accent + '20' }]}
        >
          <Ionicons name={arrow as any} size={14} color={accent} />
          <Text style={[s.badgeText, { color: accent }]}>
            {data.weekOverWeekChange}% from last week {emoji}
          </Text>
        </Animated.View>
      )}
      {data.hasLastWeekData && data.weekOverWeekDirection === 'same' && (
        <Animated.Text entering={FadeIn.delay(1000).duration(500)} style={s.subtext}>
          Almost same as last week {emoji}
        </Animated.Text>
      )}
      {!data.hasLastWeekData && (
        <Animated.Text entering={FadeIn.delay(1000).duration(500)} style={[s.subtext, { color: colors.accent }]}>
          Your first tracked week!
        </Animated.Text>
      )}
    </View>
  );
}

function CategorySlide({ data }: { data: WeeklyReportData }) {
  const colors = useColors();
  const cat = data.topCategory;
  if (!cat) return null;
  const color =
    colors.categories[cat.key as keyof typeof colors.categories] ||
    colors.categories.general;

  return (
    <View style={s.center} pointerEvents="box-none">
      <Animated.Text entering={FadeIn.delay(100).duration(400)} style={s.slideLabel}>
        Your biggest expense
      </Animated.Text>
      <Animated.View entering={FadeInDown.delay(300).duration(500)} style={s.catIconRow}>
        <View style={[s.catIconBg, { backgroundColor: color + '25' }]}>
          <Ionicons name={cat.icon as any} size={36} color={color} />
        </View>
      </Animated.View>
      <Animated.Text entering={FadeInDown.delay(500).duration(400)} style={[s.catName, { color }]}>
        {cat.label}
      </Animated.Text>
      <Animated.View entering={FadeIn.delay(700).duration(400)}>
        <AnimatedAmount
          value={cat.amount}
          formatter={formatPKR}
          style={s.catAmount}
          duration={800}
        />
      </Animated.View>
      <Animated.Text entering={FadeIn.delay(900).duration(400)} style={s.subtext}>
        {cat.percentage}% of your spending
      </Animated.Text>
    </View>
  );
}

function BehaviorSlide({ data }: { data: WeeklyReportData }) {
  const accent = '#3B82F6';
  const hasWeekend = data.weekendTotal > 0;
  const maxVal = Math.max(data.weekdayTotal, data.weekendTotal, 1);

  return (
    <View style={s.center} pointerEvents="box-none">
      <Animated.Text entering={FadeIn.delay(100).duration(400)} style={[s.behaviorTitle, { color: accent }]}>
        {hasWeekend && data.weekendMultiplier >= 1.5
          ? 'Weekends hit different...'
          : hasWeekend
            ? 'Your week, side by side'
            : 'Weekdays only so far'}
      </Animated.Text>

      {hasWeekend && data.weekendMultiplier >= 1.5 && (
        <Animated.Text entering={FadeIn.delay(400).duration(400)} style={s.subtext}>
          You spent {data.weekendMultiplier}x more on Sat & Sun
        </Animated.Text>
      )}

      <Animated.View entering={FadeInDown.delay(600).duration(500)} style={s.barCompare}>
        {/* Weekday bar */}
        <View style={s.barGroup}>
          <Text style={s.barLabel}>Mon{'\u2013'}Fri</Text>
          <View style={s.barTrack}>
            <View
              style={[
                s.barFill,
                {
                  width: `${Math.max((data.weekdayTotal / maxVal) * 100, 4)}%`,
                  backgroundColor: accent + '60',
                },
              ]}
            />
          </View>
          <Text style={s.barValue}>{formatPKR(data.weekdayTotal)}</Text>
        </View>
        {/* Weekend bar */}
        <View style={s.barGroup}>
          <Text style={s.barLabel}>Sat{'\u2013'}Sun</Text>
          <View style={s.barTrack}>
            <View
              style={[
                s.barFill,
                {
                  width: `${Math.max((data.weekendTotal / maxVal) * 100, 4)}%`,
                  backgroundColor: accent,
                },
              ]}
            />
          </View>
          <Text style={s.barValue}>{formatPKR(data.weekendTotal)}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

function AwarenessSlide({ data }: { data: WeeklyReportData }) {
  const colors = useColors();
  const perfect = data.daysLogged >= 7;
  return (
    <View style={s.center} pointerEvents="box-none">
      <Animated.Text entering={FadeIn.delay(100).duration(400)} style={s.slideLabel}>
        You logged
      </Animated.Text>
      <Animated.View entering={FadeInDown.delay(300).duration(500)} style={s.daysRow}>
        <Text style={s.daysNumber}>{data.daysLogged}</Text>
        <Text style={s.daysSeparator}>/</Text>
        <Text style={s.daysTotal}>7</Text>
        <Text style={s.daysLabel}> days</Text>
      </Animated.View>

      {/* Mini week dots */}
      <Animated.View entering={FadeIn.delay(700).duration(400)} style={s.weekDots}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <View key={i} style={s.dotCol}>
            <Text style={s.dotLabel}>{d}</Text>
            <View
              style={[
                s.dot,
                i < data.daysLogged
                  ? { backgroundColor: colors.success }
                  : { backgroundColor: 'rgba(255,255,255,0.15)' },
              ]}
            />
          </View>
        ))}
      </Animated.View>

      <Animated.Text entering={FadeIn.delay(1000).duration(500)} style={s.subtext}>
        {perfect
          ? 'Perfect week! Every single day logged'
          : data.daysLogged >= 5
            ? 'Almost there! Push for all 7 next week'
            : "Let's hit all 7 next week"}
        {perfect ? ' \uD83C\uDF1F' : ' \uD83D\uDCAA'}
      </Animated.Text>
    </View>
  );
}

function ClosingSlide({
  onShare,
  onDetails,
}: {
  onShare: () => void;
  onDetails: () => void;
}) {
  return (
    <View style={s.center} pointerEvents="box-none">
      <Animated.Text entering={FadeInDown.delay(200).duration(500)} style={s.closingTitle}>
        That&apos;s your hisaab!
      </Animated.Text>
      <Animated.Text entering={FadeIn.delay(600).duration(400)} style={s.subtext}>
        Ready for next week?
      </Animated.Text>
      <Animated.View entering={FadeInUp.delay(900).duration(500)} style={s.closingBtns}>
        <Pressable
          onPress={onShare}
          style={({ pressed }) => [
            s.shareBtn,
            pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
          ]}
        >
          <Ionicons name="share-outline" size={20} color="#fff" />
          <Text style={s.shareBtnText}>Share Your Hisaab</Text>
        </Pressable>
        <Pressable
          onPress={onDetails}
          style={({ pressed }) => [
            s.detailsBtn,
            pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
          ]}
        >
          <Text style={s.detailsBtnText}>View Details</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── Main screen ────────────────────────────────────────────────

export default function WeeklyReportScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const [data, setData] = useState<WeeklyReportData | null>(null);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const weekExpensesRef = useRef<Expense[]>([]);

  useEffect(() => {
    (async () => {
      const exp = await getExpenses();
      weekExpensesRef.current = getExpensesForWeek(exp);
      setData(computeWeeklyReport(exp));
      setLoading(false);
    })();
  }, []);

  // Haptics per slide
  useEffect(() => {
    if (!data) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    switch (index) {
      case 1:
        timers.push(
          setTimeout(
            () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
            1200,
          ),
        );
        break;
      case 2:
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 4:
        timers.push(
          setTimeout(
            () =>
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              ),
            700,
          ),
        );
        break;
    }
    return () => timers.forEach(clearTimeout);
  }, [index, data]);

  const advance = useCallback(() => {
    if (index < TOTAL_SCREENS - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIndex(i => i + 1);
    }
  }, [index]);

  const goBack = useCallback(() => {
    if (index > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIndex(i => i - 1);
    }
  }, [index]);

  const close = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, []);

  const handleShare = useCallback(async () => {
    if (!data) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await generateWeeklyPdf(weekExpensesRef.current, data.weekLabel, data.totalSpent);
    } catch {
      Alert.alert('Error', 'Could not generate PDF report.');
    }
  }, [data]);

  const handleDetails = useCallback(() => {
    router.back();
  }, []);

  // ── Loading ───────────────────────────────────────────────────
  if (loading || !data) {
    return (
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <View style={s.center} pointerEvents="box-none">
          <Text style={s.loadingText}>Loading your hisaab...</Text>
        </View>
      </View>
    );
  }

  // ── Not enough data ───────────────────────────────────────────
  if (!data.hasEnoughData) {
    return (
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <Pressable style={[s.closeBtn, { top: insets.top + 12 }]} onPress={close}>
          <Ionicons name="close" size={28} color={TEXT_SOFT} />
        </Pressable>
        <View style={s.center} pointerEvents="box-none">
          <Text style={{ fontSize: 48, marginBottom: 16 }}>{'\uD83D\uDCCA'}</Text>
          <Text style={s.emptyTitle}>Not enough data yet</Text>
          <Text style={s.emptySubtext}>
            Log at least 3 expenses this week{'\n'}to unlock your Weekly Hisaab
          </Text>
          <Pressable onPress={close} style={s.emptyBtn}>
            <Text style={s.emptyBtnText}>Got it</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Accent glow ───────────────────────────────────────────────
  const accent = getAccent(index, data, colors);

  // ── Render current slide ──────────────────────────────────────
  function renderSlide() {
    switch (index) {
      case 0:
        return <HookSlide weekLabel={data!.weekLabel} />;
      case 1:
        return <TotalSlide data={data!} />;
      case 2:
        return <CategorySlide data={data!} />;
      case 3:
        return <BehaviorSlide data={data!} />;
      case 4:
        return <AwarenessSlide data={data!} />;
      case 5:
        return (
          <ClosingSlide onShare={handleShare} onDetails={handleDetails} />
        );
      default:
        return null;
    }
  }

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" />

      {/* Accent glow */}
      <View style={[s.glow, { backgroundColor: accent + '06' }]} />

      {/* Tap areas (behind content) */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={s.tapRow} pointerEvents="box-none">
          {index === TOTAL_SCREENS - 1 ? (
            // Final slide: tap anywhere on empty area closes the report.
            // Share / View Details buttons in ClosingSlide still receive
            // their own touches since they sit in a higher z-index layer.
            <Pressable style={s.tapClose} onPress={close} />
          ) : (
            <>
              <Pressable style={s.tapBack} onPress={goBack} />
              <Pressable style={s.tapForward} onPress={advance} />
            </>
          )}
        </View>
      </View>

      {/* Progress bar */}
      <View style={[s.progressBar, { paddingTop: insets.top + 12 }]}>
        {Array.from({ length: TOTAL_SCREENS }).map((_, i) => (
          <View
            key={i}
            style={[
              s.progressSeg,
              {
                backgroundColor:
                  i <= index ? '#fff' : 'rgba(255,255,255,0.18)',
              },
            ]}
          />
        ))}
      </View>

      {/* Close */}
      <Pressable
        style={[s.closeBtn, { top: insets.top + 32 }]}
        onPress={close}
        hitSlop={16}
      >
        <Ionicons name="close" size={26} color={TEXT_SOFT} />
      </Pressable>

      {/* Slide content (above tap areas so buttons work) */}
      <View style={s.slideWrap} pointerEvents="box-none">
        <Animated.View
          key={index}
          entering={FadeIn.duration(300)}
          style={{ flex: 1 }}
          pointerEvents="box-none"
        >
          {renderSlide()}
        </Animated.View>
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
  },

  // Progress
  progressBar: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12,
    paddingBottom: 8,
    zIndex: 10,
  },
  progressSeg: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
  },

  // Close
  closeBtn: {
    position: 'absolute',
    right: 16,
    zIndex: 20,
  },

  // Tap areas
  tapRow: {
    flex: 1,
    flexDirection: 'row',
  },
  tapBack: { flex: 3 },
  tapForward: { flex: 7 },
  tapClose: { flex: 1 },

  // Content
  slideWrap: {
    flex: 1,
    zIndex: 5,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },

  // ── Hook slide ────────────────────────────────────────────────
  hookSmall: {
    fontSize: 22,
    fontFamily: 'Inter_500Medium',
    color: TEXT_SOFT,
  },
  hookBig: {
    fontSize: 40,
    fontFamily: 'Inter_700Bold',
    color: TEXT_PRIMARY,
    marginBottom: 16,
  },
  hookDate: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 40,
  },
  tapHint: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: TEXT_DIM,
    position: 'absolute',
    bottom: 60,
  },

  // ── Generic ───────────────────────────────────────────────────
  slideLabel: {
    fontSize: 18,
    fontFamily: 'Inter_500Medium',
    color: TEXT_SOFT,
    marginBottom: 12,
  },
  bigNumber: {
    fontSize: 44,
    fontFamily: 'Inter_700Bold',
    color: TEXT_PRIMARY,
  },
  subtext: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: TEXT_DIM,
    textAlign: 'center',
    marginTop: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 20,
  },
  badgeText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },

  // ── Category ──────────────────────────────────────────────────
  catIconRow: { marginBottom: 12 },
  catIconBg: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catName: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
  },
  catAmount: {
    fontSize: 34,
    fontFamily: 'Inter_700Bold',
    color: TEXT_PRIMARY,
  },

  // ── Behavior ──────────────────────────────────────────────────
  behaviorTitle: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  barCompare: {
    width: '100%',
    gap: 20,
    marginTop: 32,
  },
  barGroup: { gap: 8 },
  barLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: TEXT_SOFT,
  },
  barTrack: {
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 7,
    minWidth: 14,
  },
  barValue: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: TEXT_PRIMARY,
  },

  // ── Awareness ─────────────────────────────────────────────────
  daysRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 24,
  },
  daysNumber: {
    fontSize: 56,
    fontFamily: 'Inter_700Bold',
    color: lightColors.success,
  },
  daysSeparator: {
    fontSize: 40,
    fontFamily: 'Inter_400Regular',
    color: TEXT_DIM,
    marginHorizontal: 4,
  },
  daysTotal: {
    fontSize: 40,
    fontFamily: 'Inter_700Bold',
    color: TEXT_DIM,
  },
  daysLabel: {
    fontSize: 20,
    fontFamily: 'Inter_500Medium',
    color: TEXT_DIM,
  },
  weekDots: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  dotCol: {
    alignItems: 'center',
    gap: 6,
  },
  dotLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: TEXT_DIM,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  // ── Closing ───────────────────────────────────────────────────
  closingTitle: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 8,
  },
  closingBtns: {
    width: '100%',
    gap: 12,
    marginTop: 40,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: lightColors.primary,
    paddingVertical: 16,
    borderRadius: 14,
  },
  shareBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  detailsBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  detailsBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: TEXT_SOFT,
  },

  // ── Empty / loading ───────────────────────────────────────────
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: TEXT_DIM,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: TEXT_DIM,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  emptyBtn: {
    backgroundColor: lightColors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  emptyBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
});
