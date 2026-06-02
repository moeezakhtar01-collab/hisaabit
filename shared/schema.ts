import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, uniqueIndex, index, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  // Frictionless anonymous accounts (v2): the device is the identity. The
  // anonymous-auth endpoint synthesizes a unique placeholder email/password
  // per device, so email/password/name stay NOT NULL and existing auth code is
  // untouched. deviceId is the stable key we upsert + resume sessions by.
  deviceId: text("device_id").unique(),
  emailConfirmed: boolean("email_confirmed").default(false).notNull(),
  confirmationToken: text("confirmation_token"),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  subscriptionPlan: text("subscription_plan").default("free").notNull(),
  voiceUsageCount: integer("voice_usage_count").default(0).notNull(),
  voiceUsageResetMonth: text("voice_usage_reset_month"),
  voiceCreditsPurchased: integer("voice_credits_purchased").default(0).notNull(),
  adsRemoved: boolean("ads_removed").default(false).notNull(),
  smsParsingEnabled: boolean("sms_parsing_enabled").default(false).notNull(),
  lastSmsReadTimestamp: timestamp("last_sms_read_timestamp"),
  hasSeenDemo: boolean("has_seen_demo").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const expenses = pgTable("expenses", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  category: text("category").notNull(),
  note: text("note").default(""),
  date: text("date").notNull(),
  // Provenance. v2's only active source is 'notification' (passive capture);
  // 'manual'/'voice' remain for the now-hidden entry paths.
  source: text("source").default("manual").notNull(),
  // Per-transaction fingerprint computed on-device for notification captures
  // (sender + amount + day + normalized text). Null for manual/voice. The
  // unique index below makes re-reading the same notification a no-op.
  sourceHash: text("source_hash"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  // History queries always filter on userId and order by date desc.
  // Without this, every list-load is a table scan once a power user
  // crosses ~5k expenses. Cheap insurance to add now.
  index("expenses_user_date_idx").on(table.userId, table.date),
  // DB-level dedupe for captured expenses. Postgres treats NULLs as distinct,
  // so manual/voice rows (null hash) never collide — only real captures dedupe.
  uniqueIndex("expenses_user_source_hash_idx").on(table.userId, table.sourceHash),
]);

export const budgets = pgTable("budgets", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  limit: integer("limit").notNull(),
  month: text("month").notNull(),
}, (table) => [
  // One budget per category per month per user. The check-then-insert
  // upsert in storage.ts is racy under concurrent saves — this index
  // makes the duplicate impossible at the DB level. Once present we
  // can switch the upsert to onConflictDoUpdate.
  uniqueIndex("budgets_user_category_month_idx").on(table.userId, table.category, table.month),
]);

export const monthlyBudgets = pgTable("monthly_budgets", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  month: text("month").notNull(),
  totalLimit: integer("total_limit").notNull(),
}, (table) => [
  // One total budget per month per user. Same race-condition guard as
  // `budgets` above.
  uniqueIndex("monthly_budgets_user_month_idx").on(table.userId, table.month),
]);

export const budgetSettings = pgTable("budget_settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  dailyLimit: integer("daily_limit"),
  weeklyLimit: integer("weekly_limit"),
});

export const processedSms = pgTable("processed_sms", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  smsHash: text("sms_hash").notNull(),
  smsTimestamp: timestamp("sms_timestamp"),
  processedAt: timestamp("processed_at").defaultNow(),
}, (table) => [
  uniqueIndex("processed_sms_user_hash_idx").on(table.userId, table.smsHash),
]);

export const pendingExpenses = pgTable("pending_expenses", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  category: text("category").notNull(),
  note: text("note").default(""),
  date: text("date").notNull(),
  smsSender: text("sms_sender"),
  smsBody: text("sms_body"),
  status: text("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Externally-managed table — created and maintained by
// `connect-pg-simple` (see server/routes.ts session config), NOT by
// our migrations. Declared here only so `drizzle-kit push` doesn't
// see it as an unknown table and try to drop it. Column shape mirrors
// connect-pg-simple's table.sql exactly:
// https://github.com/voxpelli/node-connect-pg-simple/blob/main/table.sql
export const session = pgTable("session", {
  sid: varchar("sid").primaryKey().notNull(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
}, (table) => [
  index("IDX_session_expire").on(table.expire),
]);

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  name: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type MonthlyBudget = typeof monthlyBudgets.$inferSelect;
export type BudgetSettings = typeof budgetSettings.$inferSelect;
export type ProcessedSms = typeof processedSms.$inferSelect;
export type PendingExpense = typeof pendingExpenses.$inferSelect;
