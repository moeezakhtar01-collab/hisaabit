import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  FadeIn,
  FadeOut,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useColors } from '@/lib/theme-context';
import { type ThemeColors } from '@/constants/colors';
import { Expense, formatPKR } from '@/lib/storage';
import AnimatedAmount from './AnimatedAmount';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CALENDAR_MAX_HEIGHT = 420;

type DayState = 'logged' | 'missing' | 'today' | 'future';

interface WeeklyOverviewProps {
  expenses: Expense[];
}

function getDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWeekDays(): Date[] {
  const now = new Date();
  const dow = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dow + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function getDayState(dayKey: string, total: number, todayKey: string): DayState {
  if (total > 0) return 'logged';
  if (dayKey === todayKey) return 'today';
  if (dayKey > todayKey) return 'future';
  return 'missing';
}

function abbreviateAmount(amount: number): string {
  if (amount >= 10000) return `${Math.round(amount / 1000)}k`;
  if (amount >= 1000) {
    const k = amount / 1000;
    return k % 1 === 0 ? `${k}k` : `${k.toFixed(1)}k`;
  }
  return String(amount);
}

function getMonthGrid(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const cells: { date: Date; dayKey: string; inMonth: boolean }[] = [];

  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, -i);
    cells.push({ date: d, dayKey: getDayKey(d), inMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    cells.push({ date: d, dayKey: getDayKey(d), inMonth: true });
  }

  while (cells.length % 7 !== 0) {
    const nextDay = cells.length - startDow - daysInMonth + 1;
    const d = new Date(year, month, nextDay);
    cells.push({ date: d, dayKey: getDayKey(d), inMonth: false });
  }

  const rows: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

export default function WeeklyOverview({ expenses }: WeeklyOverviewProps) {
  const colors = useColors();
  const styles = createStyles(colors);
  const [expanded, setExpanded] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [completedDays, setCompletedDays] = useState<Set<string>>(new Set());
  const prevTotalsRef = useRef<Map<string, number>>(new Map());
  const calendarAnim = useSharedValue(0);

  const todayKey = useMemo(() => getDayKey(new Date()), []);
  const weekDays = useMemo(() => getWeekDays(), []);

  const expensesByDay = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach(e => {
      const dateOnly = e.date.includes('T') ? e.date.split('T')[0] : e.date;
      map.set(dateOnly, (map.get(dateOnly) || 0) + e.amount);
    });
    return map;
  }, [expenses]);

  const weekData = useMemo(() => {
    return weekDays.map(day => {
      const key = getDayKey(day);
      const total = expensesByDay.get(key) || 0;
      const state = getDayState(key, total, todayKey);
      return { date: day, key, total, state };
    });
  }, [weekDays, todayKey, expensesByDay]);

  const weekTotal = useMemo(() => weekData.reduce((s, d) => s + d.total, 0), [weekData]);

  const weekDateRange = useMemo(() => {
    const start = weekDays[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const end = weekDays[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return `${start} \u2013 ${end}`;
  }, [weekDays]);

  // Detect newly completed days
  useEffect(() => {
    const current = new Map<string, number>();
    const newly: string[] = [];

    weekData.forEach(({ key, total }) => {
      current.set(key, total);
      const prev = prevTotalsRef.current.get(key) || 0;
      if (key <= todayKey && prev === 0 && total > 0 && prevTotalsRef.current.size > 0) {
        newly.push(key);
      }
    });

    prevTotalsRef.current = current;

    if (newly.length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCompletedDays(new Set(newly));
      const timer = setTimeout(() => setCompletedDays(new Set()), 2500);
      return () => clearTimeout(timer);
    }
  }, [weekData, todayKey]);

  const toggleCalendar = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const willExpand = !expanded;
    setExpanded(willExpand);
    calendarAnim.value = withTiming(willExpand ? 1 : 0, {
      duration: 350,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [expanded, calendarAnim]);

  const calendarContainerStyle = useAnimatedStyle(() => ({
    maxHeight: interpolate(calendarAnim.value, [0, 1], [0, CALENDAR_MAX_HEIGHT]),
    opacity: calendarAnim.value,
  }));

  const navigateMonth = useCallback((dir: -1 | 1) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCalendarMonth(prev => {
      const [y, m] = prev.split('-').map(Number);
      const d = new Date(y, m - 1 + dir, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
  }, []);

  const monthGrid = useMemo(() => getMonthGrid(calendarMonth), [calendarMonth]);

  const calendarMonthLabel = useMemo(() => {
    const [y, m] = calendarMonth.split('-').map(Number);
    return new Date(y, m - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [calendarMonth]);

  const handleDayPress = useCallback((key: string, state: DayState) => {
    if (state === 'future') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/period-expenses', params: { period: 'day', date: key } });
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <Pressable onPress={toggleCalendar}>
        <View style={styles.weekHeader}>
          <Text style={styles.weekTitle}>This Week</Text>
          <View style={styles.weekHeaderRight}>
            <Text style={styles.weekRange}>{weekDateRange}</Text>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textSecondary}
            />
          </View>
        </View>
      </Pressable>

      {/* Week strip */}
      <View style={styles.weekStrip}>
        {weekData.map(({ key, total, state }, i) => {
          const isToday = key === todayKey;
          const isCompleted = completedDays.has(key);

          return (
            <Pressable
              key={key}
              onPress={() => handleDayPress(key, state)}
              style={styles.dayColumn}
            >
              <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                {DAY_LABELS[i]}
              </Text>
              <View
                style={[
                  styles.dayCell,
                  state === 'logged' && styles.dayCellLogged,
                  state === 'missing' && styles.dayCellMissing,
                  isToday && state !== 'logged' && styles.dayCellToday,
                  isCompleted && styles.dayCellCompleted,
                ]}
              >
                {isCompleted ? (
                  <Animated.View entering={FadeIn.duration(300)}>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  </Animated.View>
                ) : state === 'logged' ? (
                  <Text style={styles.dayAmount}>{abbreviateAmount(total)}</Text>
                ) : state === 'missing' ? (
                  <View style={styles.missingDot} />
                ) : (
                  <Text style={styles.dayDash}>{'\u2013'}</Text>
                )}
              </View>
              {isToday && <View style={styles.todayIndicator} />}
            </Pressable>
          );
        })}
      </View>

      {/* Week total */}
      {weekTotal > 0 && (
        <Pressable onPress={toggleCalendar}>
          <View style={styles.weekTotalRow}>
            <Text style={styles.weekTotalLabel}>Week total</Text>
            <AnimatedAmount
              value={weekTotal}
              formatter={formatPKR}
              style={styles.weekTotalAmount}
            />
          </View>
        </Pressable>
      )}

      {/* Day completed toast */}
      {completedDays.size > 0 && (
        <Animated.View
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(300)}
          style={styles.completedToast}
        >
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.completedToastText}>Day completed!</Text>
        </Animated.View>
      )}

      {/* Calendar expansion */}
      <Animated.View style={[styles.calendarContainer, calendarContainerStyle]}>
        <View style={styles.calendarInner}>
          {/* Month navigation */}
          <View style={styles.calendarHeader}>
            <Pressable onPress={() => navigateMonth(-1)} hitSlop={12}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>
            <Text style={styles.calendarMonthLabel}>{calendarMonthLabel}</Text>
            <Pressable onPress={() => navigateMonth(1)} hitSlop={12}>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </Pressable>
          </View>

          {/* Day-of-week header */}
          <View style={styles.calendarDowRow}>
            {DAY_LABELS.map(d => (
              <Text key={d} style={styles.calendarDowLabel}>{d.slice(0, 2)}</Text>
            ))}
          </View>

          {/* Month grid */}
          {monthGrid.map((row, ri) => (
            <View key={ri} style={styles.calendarRow}>
              {row.map(({ date, dayKey, inMonth }) => {
                const total = expensesByDay.get(dayKey) || 0;
                const state = getDayState(dayKey, total, todayKey);
                const isToday = dayKey === todayKey;

                return (
                  <Pressable
                    key={dayKey}
                    onPress={() => {
                      if (inMonth) handleDayPress(dayKey, state);
                    }}
                    style={styles.calendarCell}
                  >
                    <View
                      style={[
                        styles.calendarDayCircle,
                        isToday && styles.calendarDayToday,
                        inMonth && state === 'logged' && styles.calendarDayLogged,
                      ]}
                    >
                      <Text
                        style={[
                          styles.calendarDayNum,
                          !inMonth && styles.calendarDayOutside,
                          isToday && styles.calendarDayNumToday,
                          inMonth && state === 'logged' && styles.calendarDayNumLogged,
                        ]}
                      >
                        {date.getDate()}
                      </Text>
                    </View>
                    {inMonth && state === 'logged' && (
                      <Text style={styles.calendarDayAmountText}>{abbreviateAmount(total)}</Text>
                    )}
                    {inMonth && state === 'missing' && (
                      <View style={styles.calendarMissingIndicator} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </Animated.View>

    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  weekTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
  },
  weekHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  weekRange: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
  },
  weekStrip: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  dayColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  dayLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
  },
  dayLabelToday: {
    color: colors.primary,
    fontFamily: 'Inter_700Bold',
  },
  dayCell: {
    width: 38,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  dayCellLogged: {
    backgroundColor: colors.primary + '15',
  },
  dayCellMissing: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.textSecondary + '35',
    borderStyle: 'dashed' as any,
  },
  dayCellToday: {
    backgroundColor: colors.primary + '08',
    borderWidth: 1.5,
    borderColor: colors.primary + '30',
  },
  dayCellCompleted: {
    backgroundColor: colors.success,
  },
  dayAmount: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: colors.primary,
  },
  missingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textSecondary + '50',
  },
  dayDash: {
    fontSize: 14,
    lineHeight: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary + '50',
    textAlign: 'center',
    includeFontPadding: false,
  },
  todayIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: 2,
  },
  weekTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border + '80',
  },
  weekTotalLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
  },
  weekTotalAmount: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: colors.text,
  },
  completedToast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: colors.success + '10',
    borderTopWidth: 1,
    borderTopColor: colors.success + '20',
  },
  completedToastText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: colors.success,
  },
  calendarContainer: {
    overflow: 'hidden',
  },
  calendarInner: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border + '80',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  calendarMonthLabel: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
  },
  calendarDowRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  calendarDowLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textSecondary,
  },
  calendarRow: {
    flexDirection: 'row',
  },
  calendarCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 3,
    minHeight: 48,
  },
  calendarDayCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayToday: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  calendarDayLogged: {
    backgroundColor: colors.primary + '15',
  },
  calendarDayNum: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: colors.text,
  },
  calendarDayOutside: {
    color: colors.textSecondary + '30',
  },
  calendarDayNumToday: {
    fontFamily: 'Inter_700Bold',
    color: colors.primary,
  },
  calendarDayNumLogged: {
    color: colors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  calendarDayAmountText: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    color: colors.primary,
    marginTop: 1,
  },
  calendarMissingIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.warning + '60',
    marginTop: 3,
  },
});
