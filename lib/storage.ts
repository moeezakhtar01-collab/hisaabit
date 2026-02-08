import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Expense {
  id: string;
  amount: number;
  category: string;
  note: string;
  date: string;
  createdAt: string;
}

export interface Budget {
  category: string;
  limit: number;
  month: string;
}

export interface MonthlyBudget {
  month: string;
  totalLimit: number;
}

export interface MonthlyData {
  expenses: Expense[];
  budgets: Budget[];
}

const EXPENSES_KEY = 'hisaab_expenses';
const BUDGETS_KEY = 'hisaab_budgets';
const MONTHLY_BUDGET_KEY = 'hisaab_monthly_budget';

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

export async function getExpenses(): Promise<Expense[]> {
  try {
    const data = await AsyncStorage.getItem(EXPENSES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function addExpense(expense: Omit<Expense, 'id' | 'createdAt'>): Promise<Expense> {
  const expenses = await getExpenses();
  const newExpense: Expense = {
    ...expense,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  expenses.unshift(newExpense);
  await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
  return newExpense;
}

export async function deleteExpense(id: string): Promise<void> {
  const expenses = await getExpenses();
  const filtered = expenses.filter(e => e.id !== id);
  await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(filtered));
}

export async function getBudgets(): Promise<Budget[]> {
  try {
    const data = await AsyncStorage.getItem(BUDGETS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function setBudget(budget: Budget): Promise<void> {
  const budgets = await getBudgets();
  const existingIndex = budgets.findIndex(
    b => b.category === budget.category && b.month === budget.month
  );
  if (existingIndex >= 0) {
    budgets[existingIndex] = budget;
  } else {
    budgets.push(budget);
  }
  await AsyncStorage.setItem(BUDGETS_KEY, JSON.stringify(budgets));
}

export async function deleteBudget(category: string, month: string): Promise<void> {
  const budgets = await getBudgets();
  const filtered = budgets.filter(b => !(b.category === category && b.month === month));
  await AsyncStorage.setItem(BUDGETS_KEY, JSON.stringify(filtered));
}

export async function getMonthlyBudgets(): Promise<MonthlyBudget[]> {
  try {
    const data = await AsyncStorage.getItem(MONTHLY_BUDGET_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function getMonthlyBudget(month: string): Promise<MonthlyBudget | null> {
  const all = await getMonthlyBudgets();
  return all.find(b => b.month === month) || null;
}

export async function setMonthlyBudget(budget: MonthlyBudget): Promise<void> {
  const all = await getMonthlyBudgets();
  const existingIndex = all.findIndex(b => b.month === budget.month);
  if (existingIndex >= 0) {
    all[existingIndex] = budget;
  } else {
    all.push(budget);
  }
  await AsyncStorage.setItem(MONTHLY_BUDGET_KEY, JSON.stringify(all));
}

export async function deleteMonthlyBudget(month: string): Promise<void> {
  const all = await getMonthlyBudgets();
  const filtered = all.filter(b => b.month !== month);
  await AsyncStorage.setItem(MONTHLY_BUDGET_KEY, JSON.stringify(filtered));
}

export function getMonthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getExpensesForMonth(expenses: Expense[], monthKey: string): Expense[] {
  return expenses.filter(e => {
    const expDate = new Date(e.date);
    const expMonthKey = getMonthKey(expDate);
    return expMonthKey === monthKey;
  });
}

export function getTotalForCategory(expenses: Expense[], category: string): number {
  return expenses
    .filter(e => e.category === category)
    .reduce((sum, e) => sum + e.amount, 0);
}

export function getTotalExpenses(expenses: Expense[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

export const CATEGORIES = [
  { key: 'kiryana', label: 'Kiryana', icon: 'cart' as const },
  { key: 'sabziMandi', label: 'Sabzi Mandi', icon: 'leaf' as const },
  { key: 'bijliBill', label: 'Bijli Bill', icon: 'flash' as const },
  { key: 'gasBill', label: 'Gas Bill', icon: 'flame' as const },
  { key: 'paniBill', label: 'Pani Bill', icon: 'water' as const },
  { key: 'schoolFees', label: 'School Fees', icon: 'school' as const },
  { key: 'transport', label: 'Transport', icon: 'car' as const },
  { key: 'mobileRecharge', label: 'Mobile Recharge', icon: 'phone-portrait' as const },
  { key: 'medical', label: 'Medical', icon: 'medkit' as const },
  { key: 'chaiNashta', label: 'Chai / Nashta', icon: 'cafe' as const },
  { key: 'kapray', label: 'Kapray', icon: 'shirt' as const },
  { key: 'rent', label: 'Rent', icon: 'home' as const },
  { key: 'general', label: 'General', icon: 'ellipsis-horizontal-circle' as const },
] as const;

export function getCategoryLabel(key: string): string {
  const cat = CATEGORIES.find(c => c.key === key);
  return cat ? cat.label : key;
}

export function getCategoryIcon(key: string): string {
  const cat = CATEGORIES.find(c => c.key === key);
  return cat ? cat.icon : 'ellipsis-horizontal-circle';
}

export function formatPKR(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-PK')}`;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

export function getMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
