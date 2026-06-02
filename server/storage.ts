import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db } from "./db";
import { users, expenses, budgets, monthlyBudgets, budgetSettings, processedSms, pendingExpenses, type User, type InsertUser, type Expense, type Budget, type MonthlyBudget, type BudgetSettings, type ProcessedSms, type PendingExpense } from "@shared/schema";

export async function createUser(data: InsertUser & { confirmationToken?: string }): Promise<User> {
  const [user] = await db.insert(users).values(data).returning();
  return user;
}

/**
 * Frictionless anonymous account: look up by deviceId, or create one.
 *
 * email/password stay NOT NULL (so existing auth code is untouched), so we
 * synthesize unique placeholders: the email is derived from the deviceId, and
 * the password is random bytes that are NOT a bcrypt hash — so bcrypt.compare
 * always returns false and nobody can ever password-login to an anonymous
 * account. emailConfirmed=true so the account is usable immediately. If the
 * user later "upgrades", we just set a real email + bcrypt password on this row.
 *
 * onConflictDoNothing(deviceId) + re-select makes concurrent first-launch
 * requests for the same device converge on one account.
 */
export async function getOrCreateAnonymousUser(deviceId: string): Promise<User> {
  const [existing] = await db.select().from(users).where(eq(users.deviceId, deviceId)).limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(users)
    .values({
      deviceId,
      email: `anon+${deviceId}@hisaabit.app`,
      password: randomBytes(32).toString("hex"),
      name: "You",
      emailConfirmed: true,
    })
    .onConflictDoNothing({ target: users.deviceId })
    .returning();
  if (created) return created;

  // Lost the insert race — another request created it first. Fetch it.
  const [after] = await db.select().from(users).where(eq(users.deviceId, deviceId)).limit(1);
  return after;
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

/**
 * Insert an auto-captured (notification-parsed) expense, deduped at the DB level.
 * sourceHash is a per-transaction fingerprint computed on-device; the unique
 * (user_id, source_hash) index makes a re-read a no-op. Returns the new row, or
 * null when it was a duplicate (already captured).
 */
export async function addCapturedExpense(
  userId: string,
  data: { amount: number; category: string; note: string; date: string; sourceHash: string },
): Promise<Expense | null> {
  const [created] = await db
    .insert(expenses)
    .values({
      userId,
      amount: data.amount,
      category: data.category,
      note: data.note,
      date: data.date,
      source: "notification",
      sourceHash: data.sourceHash,
    })
    .onConflictDoNothing({ target: [expenses.userId, expenses.sourceHash] })
    .returning();
  return created || null;
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
  // Single-statement upsert. Backed by `budgets_user_category_month_idx`
  // unique index — one row per (user, category, month). The previous
  // check-then-insert was racy under concurrent saves and could lose
  // an edit. onConflictDoUpdate is atomic.
  const [budget] = await db
    .insert(budgets)
    .values({ userId, ...data })
    .onConflictDoUpdate({
      target: [budgets.userId, budgets.category, budgets.month],
      set: { limit: data.limit },
    })
    .returning();
  return budget;
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
  // Backed by `monthly_budgets_user_month_idx` unique index — one
  // total budget per (user, month). Race-free vs the previous
  // check-then-insert.
  const [budget] = await db
    .insert(monthlyBudgets)
    .values({ userId, ...data })
    .onConflictDoUpdate({
      target: [monthlyBudgets.userId, monthlyBudgets.month],
      set: { totalLimit: data.totalLimit },
    })
    .returning();
  return budget;
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
