import { apiRequest, getApiUrl } from '@/lib/query-client';
import { fetch } from 'expo/fetch';

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

export async function getExpenses(): Promise<Expense[]> {
  try {
    const res = await apiRequest('GET', '/api/expenses');
    return await res.json();
  } catch {
    return [];
  }
}

export async function addExpense(expense: Omit<Expense, 'id' | 'createdAt'>): Promise<Expense> {
  const res = await apiRequest('POST', '/api/expenses', expense);
  return await res.json();
}

export async function updateExpense(id: string, expense: Omit<Expense, 'id' | 'createdAt'>): Promise<Expense> {
  const res = await apiRequest('PUT', `/api/expenses/${id}`, expense);
  return await res.json();
}

export async function deleteExpense(id: string): Promise<void> {
  await apiRequest('DELETE', `/api/expenses/${id}`);
}

export async function getBudgets(): Promise<Budget[]> {
  try {
    const res = await apiRequest('GET', '/api/budgets');
    const data = await res.json();
    return data.map((b: any) => ({ category: b.category, limit: b.limit, month: b.month }));
  } catch {
    return [];
  }
}

export async function setBudget(budget: Budget): Promise<void> {
  await apiRequest('POST', '/api/budgets', budget);
}

export async function deleteBudget(category: string, month: string): Promise<void> {
  await apiRequest('DELETE', `/api/budgets/${encodeURIComponent(category)}/${encodeURIComponent(month)}`);
}

export async function getMonthlyBudgets(): Promise<MonthlyBudget[]> {
  try {
    const res = await apiRequest('GET', '/api/monthly-budgets');
    const data = await res.json();
    return data.map((b: any) => ({ month: b.month, totalLimit: b.totalLimit }));
  } catch {
    return [];
  }
}

export async function getMonthlyBudget(month: string): Promise<MonthlyBudget | null> {
  try {
    const res = await apiRequest('GET', `/api/monthly-budgets/${encodeURIComponent(month)}`);
    const data = await res.json();
    if (!data) return null;
    return { month: data.month, totalLimit: data.totalLimit };
  } catch {
    return null;
  }
}

export async function setMonthlyBudget(budget: MonthlyBudget): Promise<void> {
  await apiRequest('POST', '/api/monthly-budgets', budget);
}

export async function deleteMonthlyBudget(month: string): Promise<void> {
  await apiRequest('DELETE', `/api/monthly-budgets/${encodeURIComponent(month)}`);
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
  { key: 'kiryana', label: 'Grocery', icon: 'cart' as const },
  { key: 'sabziMandi', label: 'Sabzi Mandi', icon: 'leaf' as const },
  { key: 'bijliBill', label: 'Bijli Bill', icon: 'flash' as const },
  { key: 'gasBill', label: 'Gas Bill', icon: 'flame' as const },
  { key: 'paniBill', label: 'Pani Bill', icon: 'water' as const },
  { key: 'schoolFees', label: 'School Fees', icon: 'school' as const },
  { key: 'transport', label: 'Transport', icon: 'car' as const },
  { key: 'mobileRecharge', label: 'Mobile Recharge', icon: 'phone-portrait' as const },
  { key: 'medical', label: 'Medical', icon: 'medkit' as const },
  { key: 'chaiNashta', label: 'Food', icon: 'cafe' as const },
  { key: 'kapray', label: 'Shopping', icon: 'shirt' as const },
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

export interface BudgetSettings {
  dailyLimit: number | null;
  weeklyLimit: number | null;
}

export async function getBudgetSettingsApi(): Promise<BudgetSettings | null> {
  try {
    const res = await apiRequest('GET', '/api/budget-settings');
    const data = await res.json();
    if (!data) return null;
    return { dailyLimit: data.dailyLimit, weeklyLimit: data.weeklyLimit };
  } catch {
    return null;
  }
}

export async function saveBudgetSettings(settings: Partial<BudgetSettings>): Promise<void> {
  await apiRequest('PUT', '/api/budget-settings', settings);
}

export function getWeekDateRange(): { start: Date; end: Date; label: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const startLabel = monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const endLabel = sunday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return { start: monday, end: sunday, label: `${startLabel} - ${endLabel}` };
}

export function getExpensesForWeek(expenses: Expense[]): Expense[] {
  const { start, end } = getWeekDateRange();
  return expenses.filter(e => {
    const d = new Date(e.date);
    return d >= start && d <= end;
  });
}

export function getExpensesForToday(expenses: Expense[]): Expense[] {
  const today = new Date();
  return expenses.filter(e => new Date(e.date).toDateString() === today.toDateString());
}
