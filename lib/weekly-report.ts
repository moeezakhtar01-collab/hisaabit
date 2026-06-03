import { Expense, getCategoryLabel, getCategoryIcon, CATEGORIES } from './storage';

// --- Types ---

export interface PersonalityType {
  id: string;
  label: string;
  emoji: string;
  tagline: string;
}

export interface WeeklyReportData {
  weekLabel: string;

  totalSpent: number;
  lastWeekTotal: number;
  weekOverWeekChange: number;
  weekOverWeekDirection: 'up' | 'down' | 'same';
  hasLastWeekData: boolean;

  topCategory: {
    key: string;
    label: string;
    icon: string;
    amount: number;
    percentage: number;
  } | null;

  weekdayTotal: number;
  weekendTotal: number;
  weekendMultiplier: number;

  personality: PersonalityType;

  funExpense: {
    amount: number;
    note: string;
    category: string;
    categoryLabel: string;
  } | null;

  daysLogged: number;
  expenseCount: number;
  hasEnoughData: boolean;
}

// --- Personality bank ---

const PERSONALITIES: Record<string, PersonalityType> = {
  weekendSpender: {
    id: 'weekendSpender',
    label: 'The Weekend Spender',
    emoji: '\uD83D\uDED2',
    tagline: '"Bas weekend hai, treat banta hai"',
  },
  foodie: {
    id: 'foodie',
    label: 'The Chai Champion',
    emoji: '\u2615',
    tagline: '"Chai pe charcha, kharcha pe kharcha"',
  },
  billPayer: {
    id: 'billPayer',
    label: 'The Bill Master',
    emoji: '\u26A1',
    tagline: '"Bills on time, life is fine"',
  },
  minimalist: {
    id: 'minimalist',
    label: 'The Minimalist',
    emoji: '\uD83C\uDFAF',
    tagline: '"Kam kharcha, zyada sukoon"',
  },
  splurger: {
    id: 'splurger',
    label: 'The Big Spender',
    emoji: '\uD83D\uDCB8',
    tagline: '"Paisa aata hai, chala bhi jaata hai"',
  },
  tracker: {
    id: 'tracker',
    label: 'The Perfect Tracker',
    emoji: '\uD83D\uDCCA',
    tagline: '"Hisaab bilkul clear hai boss"',
  },
  steady: {
    id: 'steady',
    label: 'The Steady One',
    emoji: '\u2696\uFE0F',
    tagline: '"Balance hi toh sab kuch hai"',
  },
  shopper: {
    id: 'shopper',
    label: 'The Shopper',
    emoji: '\uD83D\uDED2',
    tagline: '"Sale laga hai, aur kya chahiye"',
  },
};

// --- Helpers ---

function parseDate(dateString: string): Date {
  const dateOnly = dateString.includes('T') ? dateString.split('T')[0] : dateString;
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getWeekRange(offset: number = 0) {
  const now = new Date();
  const dow = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dow + 6) % 7) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const fmt = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return { start: monday, end: sunday, label: `${fmt(monday)} \u2013 ${fmt(sunday)}` };
}

function inRange(expenses: Expense[], start: Date, end: Date): Expense[] {
  return expenses.filter(e => {
    const d = parseDate(e.date);
    return d >= start && d <= end;
  });
}

// --- Main ---

export function computeWeeklyReport(allExpenses: Expense[]): WeeklyReportData {
  const cur = getWeekRange(0);
  const prev = getWeekRange(-1);

  const curExp = inRange(allExpenses, cur.start, cur.end);
  const prevExp = inRange(allExpenses, prev.start, prev.end);

  const totalSpent = curExp.reduce((s, e) => s + e.amount, 0);
  const lastWeekTotal = prevExp.reduce((s, e) => s + e.amount, 0);

  const hasLastWeekData = lastWeekTotal > 0;
  let weekOverWeekChange = 0;
  let weekOverWeekDirection: 'up' | 'down' | 'same' = 'same';
  if (hasLastWeekData) {
    weekOverWeekChange = Math.round(
      ((totalSpent - lastWeekTotal) / lastWeekTotal) * 100,
    );
    weekOverWeekDirection =
      weekOverWeekChange > 2 ? 'up' : weekOverWeekChange < -2 ? 'down' : 'same';
  }

  // Categories
  const catMap = new Map<string, number>();
  curExp.forEach(e => catMap.set(e.category, (catMap.get(e.category) || 0) + e.amount));
  const sorted = Array.from(catMap.entries())
    .map(([key, amount]) => ({
      key,
      amount,
      pct: totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const topCategory =
    sorted.length > 0
      ? {
          key: sorted[0].key,
          label: getCategoryLabel(sorted[0].key),
          icon: getCategoryIcon(sorted[0].key),
          amount: sorted[0].amount,
          percentage: sorted[0].pct,
        }
      : null;

  // Weekend vs weekday
  let weekdayTotal = 0;
  let weekendTotal = 0;
  curExp.forEach(e => {
    const dow = parseDate(e.date).getDay();
    if (dow === 0 || dow === 6) weekendTotal += e.amount;
    else weekdayTotal += e.amount;
  });
  const wdAvg = weekdayTotal / 5;
  const weAvg = weekendTotal / 2;
  const weekendMultiplier =
    wdAvg > 0 ? Math.round((weAvg / wdAvg) * 10) / 10 : 0;

  // Fun expense (smallest, prefer one with a note)
  const withNotes = curExp.filter(e => e.note?.trim());
  const pool = withNotes.length > 0 ? withNotes : curExp;
  const fun =
    pool.length > 0
      ? pool.reduce((m, e) => (e.amount < m.amount ? e : m), pool[0])
      : null;

  // Days logged
  const days = new Set<string>();
  curExp.forEach(e => days.add(parseDate(e.date).toDateString()));

  // Personality
  const personality = detectPersonality({
    topKey: topCategory?.key || '',
    topPct: topCategory?.percentage || 0,
    weMult: weekendMultiplier,
    daysLogged: days.size,
    count: curExp.length,
    catCount: sorted.length,
  });

  return {
    weekLabel: cur.label,
    totalSpent,
    lastWeekTotal,
    weekOverWeekChange: Math.abs(weekOverWeekChange),
    weekOverWeekDirection,
    hasLastWeekData,
    topCategory,
    weekdayTotal,
    weekendTotal,
    weekendMultiplier,
    personality,
    funExpense: fun
      ? {
          amount: fun.amount,
          note: fun.note || getCategoryLabel(fun.category),
          category: fun.category,
          categoryLabel: getCategoryLabel(fun.category),
        }
      : null,
    daysLogged: days.size,
    expenseCount: curExp.length,
    hasEnoughData: curExp.length >= 3,
  };
}

function detectPersonality(d: {
  topKey: string;
  topPct: number;
  weMult: number;
  daysLogged: number;
  count: number;
  catCount: number;
}): PersonalityType {
  if (d.daysLogged >= 7) return PERSONALITIES.tracker;
  if (d.weMult >= 2) return PERSONALITIES.weekendSpender;
  if (
    ['chaiNashta', 'kiryana'].includes(d.topKey) &&
    d.topPct >= 35
  )
    return PERSONALITIES.foodie;
  if (
    ['bijliBill', 'gasBill', 'paniBill', 'rent'].includes(d.topKey) &&
    d.topPct >= 30
  )
    return PERSONALITIES.billPayer;
  if (['kapray', 'general'].includes(d.topKey) && d.topPct >= 30)
    return PERSONALITIES.shopper;
  if (d.count <= 5 && d.catCount <= 2) return PERSONALITIES.minimalist;
  if (d.catCount >= 5 && d.count >= 15) return PERSONALITIES.splurger;
  return PERSONALITIES.steady;
}

// ─── v2 redesigned weekly summary ───────────────────────────────
// Informative, dynamic-category-ready data for the new (non-story) report.

export interface CategorySlice { key: string; label: string; amount: number; pct: number; }
export interface DayBar { key: string; label: string; amount: number; isToday: boolean; }
export interface WeeklySummary {
  weekLabel: string;
  total: number;
  lastWeekTotal: number;
  deltaPct: number;        // signed % vs last week (0 when no prior data)
  hasLastWeek: boolean;
  days: DayBar[];          // Mon..Sun
  categories: CategorySlice[]; // sorted desc
  biggest: { amount: number; note: string; category: string } | null;
  txCount: number;
  activeDays: number;
  noSpendDays: number;     // among days elapsed so far this week
  avgPerActiveDay: number;
  busiest: DayBar | null;
}

// Resolve a display label for any category key — known fixed key or a
// dynamic/AI-created one (which we just title-case). Keeps the report correct
// once categories become free-form.
function labelFor(key: string): string {
  const found = CATEGORIES.find((c) => c.key === key);
  if (found) return found.label;
  return key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Other';
}

const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function computeWeeklySummary(allExpenses: Expense[]): WeeklySummary {
  const cur = getWeekRange(0);
  const prev = getWeekRange(-1);
  const curExp = inRange(allExpenses, cur.start, cur.end);
  const prevExp = inRange(allExpenses, prev.start, prev.end);

  const total = curExp.reduce((s, e) => s + e.amount, 0);
  const lastWeekTotal = prevExp.reduce((s, e) => s + e.amount, 0);
  const hasLastWeek = lastWeekTotal > 0;
  const deltaPct = hasLastWeek ? Math.round(((total - lastWeekTotal) / lastWeekTotal) * 100) : 0;

  const todayKey = dayKeyOf(new Date());
  const byDay = new Map<string, number>();
  curExp.forEach((e) => {
    const k = dayKeyOf(parseDate(e.date));
    byDay.set(k, (byDay.get(k) || 0) + e.amount);
  });
  const days: DayBar[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(cur.start);
    d.setDate(cur.start.getDate() + i);
    const k = dayKeyOf(d);
    days.push({ key: k, label: DOW_LABELS[i], amount: byDay.get(k) || 0, isToday: k === todayKey });
  }

  const catMap = new Map<string, number>();
  curExp.forEach((e) => catMap.set(e.category, (catMap.get(e.category) || 0) + e.amount));
  const categories: CategorySlice[] = Array.from(catMap.entries())
    .map(([key, amount]) => ({ key, label: labelFor(key), amount, pct: total > 0 ? Math.round((amount / total) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount);

  const biggestExp = curExp.length ? curExp.reduce((m, e) => (e.amount > m.amount ? e : m), curExp[0]) : null;

  const activeDays = new Set(curExp.map((e) => dayKeyOf(parseDate(e.date)))).size;
  const elapsed = Math.min(7, Math.max(1, Math.floor((Date.now() - cur.start.getTime()) / 86_400_000) + 1));
  const noSpendDays = Math.max(0, elapsed - activeDays);
  const avgPerActiveDay = activeDays > 0 ? Math.round(total / activeDays) : 0;

  const busiest = days.reduce<DayBar | null>((m, d) => (!m || d.amount > m.amount ? d : m), null);

  return {
    weekLabel: cur.label,
    total,
    lastWeekTotal,
    deltaPct,
    hasLastWeek,
    days,
    categories,
    biggest: biggestExp
      ? { amount: biggestExp.amount, note: biggestExp.note?.trim() || labelFor(biggestExp.category), category: biggestExp.category }
      : null,
    txCount: curExp.length,
    activeDays,
    noSpendDays,
    avgPerActiveDay,
    busiest: busiest && busiest.amount > 0 ? busiest : null,
  };
}
