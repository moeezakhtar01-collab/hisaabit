import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { db } from "./db";
import { users, expenses, budgets, monthlyBudgets, budgetSettings, processedSms, pendingExpenses, type User, type InsertUser, type Expense, type Budget, type MonthlyBudget, type BudgetSettings, type ProcessedSms, type PendingExpense } from "@shared/schema";

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

export async function updateConfirmationToken(userId: string, token: string): Promise<void> {
  await db.update(users).set({ confirmationToken: token }).where(eq(users.id, userId));
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
  return await db.select().from(expenses).where(eq(expenses.userId, userId)).orderBy(desc(expenses.date), desc(expenses.createdAt));
}

export async function addExpense(userId: string, data: { amount: number; category: string; note: string; date: string }): Promise<Expense> {
  const [expense] = await db.insert(expenses).values({ userId, ...data }).returning();
  return expense;
}

export async function updateExpenseById(userId: string, expenseId: string, data: { amount: number; category: string; note: string; date: string }): Promise<Expense | null> {
  const [updated] = await db
    .update(expenses)
    .set({ amount: data.amount, category: data.category, note: data.note, date: data.date })
    .where(and(eq(expenses.id, expenseId), eq(expenses.userId, userId)))
    .returning();
  return updated || null;
}

export async function deleteExpenseById(userId: string, expenseId: string): Promise<boolean> {
  const result = await db.delete(expenses).where(and(eq(expenses.id, expenseId), eq(expenses.userId, userId))).returning();
  return result.length > 0;
}

export async function getBudgetsByUser(userId: string): Promise<Budget[]> {
  return await db.select().from(budgets).where(eq(budgets.userId, userId));
}

export async function setBudgetForUser(userId: string, data: { category: string; limit: number; month: string }): Promise<Budget> {
  return await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(budgets)
      .where(and(eq(budgets.userId, userId), eq(budgets.category, data.category), eq(budgets.month, data.month)))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await tx
        .update(budgets)
        .set({ limit: data.limit })
        .where(eq(budgets.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [budget] = await tx.insert(budgets).values({ userId, ...data }).returning();
      return budget;
    }
  });
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
  return await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(monthlyBudgets)
      .where(and(eq(monthlyBudgets.userId, userId), eq(monthlyBudgets.month, data.month)))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await tx
        .update(monthlyBudgets)
        .set({ totalLimit: data.totalLimit })
        .where(eq(monthlyBudgets.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [budget] = await tx.insert(monthlyBudgets).values({ userId, ...data }).returning();
      return budget;
    }
  });
}

export async function deleteMonthlyBudgetForUser(userId: string, month: string): Promise<boolean> {
  const result = await db
    .delete(monthlyBudgets)
    .where(and(eq(monthlyBudgets.userId, userId), eq(monthlyBudgets.month, month)))
    .returning();
  return result.length > 0;
}

export async function updateUserName(userId: string, name: string): Promise<User> {
  const [user] = await db.update(users).set({ name }).where(eq(users.id, userId)).returning();
  return user;
}

export async function updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
  await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));
}

export async function markUserDemoSeen(userId: string): Promise<void> {
  await db.update(users).set({ hasSeenDemo: true }).where(eq(users.id, userId));
}

export async function getBudgetSettings(userId: string): Promise<BudgetSettings | null> {
  const [settings] = await db.select().from(budgetSettings).where(eq(budgetSettings.userId, userId)).limit(1);
  return settings || null;
}

export async function setBudgetSettings(userId: string, data: { dailyLimit?: number | null; weeklyLimit?: number | null }): Promise<BudgetSettings> {
  return await db.transaction(async (tx) => {
    const existing = await tx.select().from(budgetSettings).where(eq(budgetSettings.userId, userId)).limit(1);

    if (existing.length > 0) {
      const updateData: any = {};
      if (data.dailyLimit !== undefined) updateData.dailyLimit = data.dailyLimit;
      if (data.weeklyLimit !== undefined) updateData.weeklyLimit = data.weeklyLimit;
      const [updated] = await tx.update(budgetSettings).set(updateData).where(eq(budgetSettings.userId, userId)).returning();
      return updated;
    } else {
      const [created] = await tx.insert(budgetSettings).values({
        userId,
        dailyLimit: data.dailyLimit ?? null,
        weeklyLimit: data.weeklyLimit ?? null,
      }).returning();
      return created;
    }
  });
}

export async function deleteUserAccount(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(pendingExpenses).where(eq(pendingExpenses.userId, userId));
    await tx.delete(processedSms).where(eq(processedSms.userId, userId));
    await tx.delete(expenses).where(eq(expenses.userId, userId));
    await tx.delete(budgets).where(eq(budgets.userId, userId));
    await tx.delete(monthlyBudgets).where(eq(monthlyBudgets.userId, userId));
    await tx.delete(budgetSettings).where(eq(budgetSettings.userId, userId));
    await tx.delete(users).where(eq(users.id, userId));
  });
}

export async function getSubscriptionInfo(userId: string): Promise<{
  plan: string;
  voiceUsageCount: number;
  voiceUsageResetMonth: string | null;
  voiceCreditsPurchased: number;
  adsRemoved: boolean;
} | null> {
  const [user] = await db.select({
    plan: users.subscriptionPlan,
    voiceUsageCount: users.voiceUsageCount,
    voiceUsageResetMonth: users.voiceUsageResetMonth,
    voiceCreditsPurchased: users.voiceCreditsPurchased,
    adsRemoved: users.adsRemoved,
  }).from(users).where(eq(users.id, userId)).limit(1);
  return user || null;
}

export async function updateSubscriptionPlan(userId: string, plan: string): Promise<void> {
  await db.update(users).set({ subscriptionPlan: plan }).where(eq(users.id, userId));
}

export async function incrementVoiceUsage(userId: string): Promise<number> {
  const [updated] = await db
    .update(users)
    .set({ voiceUsageCount: sql`voice_usage_count + 1` })
    .where(eq(users.id, userId))
    .returning({ voiceUsageCount: users.voiceUsageCount });
  return updated.voiceUsageCount;
}

export async function resetMonthlyVoiceUsage(userId: string, currentMonth: string): Promise<void> {
  await db.update(users).set({
    voiceUsageCount: 0,
    voiceUsageResetMonth: currentMonth,
  }).where(eq(users.id, userId));
}

export async function purchaseAdRemoval(userId: string): Promise<void> {
  await db.update(users).set({ adsRemoved: true }).where(eq(users.id, userId));
}

export async function purchaseVoiceCredits(userId: string, amount: number): Promise<number> {
  const [updated] = await db
    .update(users)
    .set({ voiceCreditsPurchased: sql`voice_credits_purchased + ${amount}` })
    .where(eq(users.id, userId))
    .returning({ voiceCreditsPurchased: users.voiceCreditsPurchased });
  return updated.voiceCreditsPurchased;
}

export async function deductVoiceCredit(userId: string): Promise<number> {
  const [updated] = await db
    .update(users)
    .set({ voiceCreditsPurchased: sql`GREATEST(voice_credits_purchased - 1, 0)` })
    .where(eq(users.id, userId))
    .returning({ voiceCreditsPurchased: users.voiceCreditsPurchased });
  return updated.voiceCreditsPurchased;
}

// ─── SMS Processing ──────────────────────────────────────────────

export async function bulkCheckProcessedSms(userId: string, hashes: string[]): Promise<Set<string>> {
  if (hashes.length === 0) return new Set();
  const rows = await db
    .select({ smsHash: processedSms.smsHash })
    .from(processedSms)
    .where(and(eq(processedSms.userId, userId), inArray(processedSms.smsHash, hashes)));
  return new Set(rows.map(r => r.smsHash));
}

export async function markSmsBulkProcessed(userId: string, items: { hash: string; timestamp?: Date }[]): Promise<void> {
  if (items.length === 0) return;
  await db.insert(processedSms).values(
    items.map(item => ({
      userId,
      smsHash: item.hash,
      smsTimestamp: item.timestamp ?? null,
    }))
  ).onConflictDoNothing();
}

// ─── Pending Expenses ────────────────────────────────────────────

export async function getPendingExpensesByUser(userId: string): Promise<PendingExpense[]> {
  return await db
    .select()
    .from(pendingExpenses)
    .where(and(eq(pendingExpenses.userId, userId), eq(pendingExpenses.status, "pending")))
    .orderBy(desc(pendingExpenses.createdAt));
}

export async function getPendingExpenseCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pendingExpenses)
    .where(and(eq(pendingExpenses.userId, userId), eq(pendingExpenses.status, "pending")));
  return row?.count ?? 0;
}

export async function addPendingExpense(
  userId: string,
  data: { amount: number; category: string; note: string; date: string; smsSender?: string; smsBody?: string }
): Promise<PendingExpense> {
  const [pe] = await db.insert(pendingExpenses).values({ userId, ...data }).returning();
  return pe;
}

export async function bulkAddPendingExpenses(
  userId: string,
  items: { amount: number; category: string; note: string; date: string; smsSender?: string; smsBody?: string }[]
): Promise<PendingExpense[]> {
  if (items.length === 0) return [];
  return await db
    .insert(pendingExpenses)
    .values(items.map(item => ({ userId, ...item })))
    .returning();
}

export async function updatePendingExpense(
  userId: string,
  pendingId: string,
  data: { amount?: number; category?: string; note?: string; date?: string }
): Promise<PendingExpense | null> {
  const updateData: Record<string, unknown> = {};
  if (data.amount !== undefined) updateData.amount = data.amount;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.note !== undefined) updateData.note = data.note;
  if (data.date !== undefined) updateData.date = data.date;

  const [updated] = await db
    .update(pendingExpenses)
    .set(updateData)
    .where(and(eq(pendingExpenses.id, pendingId), eq(pendingExpenses.userId, userId), eq(pendingExpenses.status, "pending")))
    .returning();
  return updated || null;
}

export async function confirmPendingExpense(userId: string, pendingId: string): Promise<Expense | null> {
  return await db.transaction(async (tx) => {
    const [pe] = await tx
      .select()
      .from(pendingExpenses)
      .where(and(eq(pendingExpenses.id, pendingId), eq(pendingExpenses.userId, userId), eq(pendingExpenses.status, "pending")))
      .limit(1);

    if (!pe) return null;

    const [expense] = await tx.insert(expenses).values({
      userId,
      amount: pe.amount,
      category: pe.category,
      note: pe.note || "",
      date: pe.date,
    }).returning();

    await tx.update(pendingExpenses).set({ status: "confirmed" }).where(eq(pendingExpenses.id, pendingId));

    return expense;
  });
}

export async function dismissPendingExpense(userId: string, pendingId: string): Promise<boolean> {
  const [updated] = await db
    .update(pendingExpenses)
    .set({ status: "dismissed" })
    .where(and(eq(pendingExpenses.id, pendingId), eq(pendingExpenses.userId, userId), eq(pendingExpenses.status, "pending")))
    .returning();
  return !!updated;
}

export async function confirmAllPending(userId: string): Promise<Expense[]> {
  return await db.transaction(async (tx) => {
    const pending = await tx
      .select()
      .from(pendingExpenses)
      .where(and(eq(pendingExpenses.userId, userId), eq(pendingExpenses.status, "pending")));

    if (pending.length === 0) return [];

    const created = await tx.insert(expenses).values(
      pending.map(pe => ({
        userId,
        amount: pe.amount,
        category: pe.category,
        note: pe.note || "",
        date: pe.date,
      }))
    ).returning();

    const ids = pending.map(pe => pe.id);
    await tx
      .update(pendingExpenses)
      .set({ status: "confirmed" })
      .where(and(eq(pendingExpenses.userId, userId), inArray(pendingExpenses.id, ids)));

    return created;
  });
}

export async function dismissAllPending(userId: string): Promise<number> {
  const result = await db
    .update(pendingExpenses)
    .set({ status: "dismissed" })
    .where(and(eq(pendingExpenses.userId, userId), eq(pendingExpenses.status, "pending")))
    .returning();
  return result.length;
}

// ─── SMS Settings ────────────────────────────────────────────────

export async function getSmsSettings(userId: string): Promise<{ smsParsingEnabled: boolean; lastSmsReadTimestamp: Date | null }> {
  const [user] = await db
    .select({ smsParsingEnabled: users.smsParsingEnabled, lastSmsReadTimestamp: users.lastSmsReadTimestamp })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user || { smsParsingEnabled: false, lastSmsReadTimestamp: null };
}

export async function updateSmsParsingEnabled(userId: string, enabled: boolean): Promise<void> {
  await db.update(users).set({ smsParsingEnabled: enabled }).where(eq(users.id, userId));
}

export async function updateLastSmsReadTimestamp(userId: string, timestamp: Date): Promise<void> {
  await db.update(users).set({ lastSmsReadTimestamp: timestamp }).where(eq(users.id, userId));
}
