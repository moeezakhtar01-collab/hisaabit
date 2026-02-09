import { eq, and, desc } from "drizzle-orm";
import { db } from "./db";
import { users, expenses, budgets, monthlyBudgets, type User, type InsertUser, type Expense, type Budget, type MonthlyBudget } from "@shared/schema";

export async function createUser(data: InsertUser & { confirmationToken?: string }): Promise<User> {
  const [user] = await db.insert(users).values(data).returning();
  return user;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user;
}

export async function getUserById(id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user;
}

export async function confirmUserEmail(token: string): Promise<boolean> {
  const result = await db
    .update(users)
    .set({ emailConfirmed: true, confirmationToken: null })
    .where(eq(users.confirmationToken, token))
    .returning();
  return result.length > 0;
}

export async function setResetToken(email: string, token: string, expiry: Date): Promise<boolean> {
  const result = await db
    .update(users)
    .set({ resetToken: token, resetTokenExpiry: expiry })
    .where(eq(users.email, email))
    .returning();
  return result.length > 0;
}

export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.resetToken, token))
    .limit(1);

  if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
    return false;
  }

  await db
    .update(users)
    .set({ password: newPassword, resetToken: null, resetTokenExpiry: null })
    .where(eq(users.id, user.id));

  return true;
}

export async function getExpensesByUser(userId: string): Promise<Expense[]> {
  return await db.select().from(expenses).where(eq(expenses.userId, userId)).orderBy(desc(expenses.createdAt));
}

export async function addExpense(userId: string, data: { amount: number; category: string; note: string; date: string }): Promise<Expense> {
  const [expense] = await db.insert(expenses).values({ userId, ...data }).returning();
  return expense;
}

export async function deleteExpenseById(userId: string, expenseId: string): Promise<boolean> {
  const result = await db.delete(expenses).where(and(eq(expenses.id, expenseId), eq(expenses.userId, userId))).returning();
  return result.length > 0;
}

export async function getBudgetsByUser(userId: string): Promise<Budget[]> {
  return await db.select().from(budgets).where(eq(budgets.userId, userId));
}

export async function setBudgetForUser(userId: string, data: { category: string; limit: number; month: string }): Promise<Budget> {
  const existing = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.category, data.category), eq(budgets.month, data.month)))
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(budgets)
      .set({ limit: data.limit })
      .where(eq(budgets.id, existing[0].id))
      .returning();
    return updated;
  } else {
    const [budget] = await db.insert(budgets).values({ userId, ...data }).returning();
    return budget;
  }
}

export async function deleteBudgetForUser(userId: string, category: string, month: string): Promise<boolean> {
  const result = await db
    .delete(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.category, category), eq(budgets.month, month)))
    .returning();
  return result.length > 0;
}

export async function getMonthlyBudgetsByUser(userId: string): Promise<MonthlyBudget[]> {
  return await db.select().from(monthlyBudgets).where(eq(monthlyBudgets.userId, userId));
}

export async function getMonthlyBudgetForUser(userId: string, month: string): Promise<MonthlyBudget | null> {
  const [budget] = await db
    .select()
    .from(monthlyBudgets)
    .where(and(eq(monthlyBudgets.userId, userId), eq(monthlyBudgets.month, month)))
    .limit(1);
  return budget || null;
}

export async function setMonthlyBudgetForUser(userId: string, data: { month: string; totalLimit: number }): Promise<MonthlyBudget> {
  const existing = await db
    .select()
    .from(monthlyBudgets)
    .where(and(eq(monthlyBudgets.userId, userId), eq(monthlyBudgets.month, data.month)))
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(monthlyBudgets)
      .set({ totalLimit: data.totalLimit })
      .where(eq(monthlyBudgets.id, existing[0].id))
      .returning();
    return updated;
  } else {
    const [budget] = await db.insert(monthlyBudgets).values({ userId, ...data }).returning();
    return budget;
  }
}

export async function deleteMonthlyBudgetForUser(userId: string, month: string): Promise<boolean> {
  const result = await db
    .delete(monthlyBudgets)
    .where(and(eq(monthlyBudgets.userId, userId), eq(monthlyBudgets.month, month)))
    .returning();
  return result.length > 0;
}
