import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  emailConfirmed: boolean("email_confirmed").default(false).notNull(),
  confirmationToken: text("confirmation_token"),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  subscriptionPlan: text("subscription_plan").default("free").notNull(),
  voiceUsageCount: integer("voice_usage_count").default(0).notNull(),
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
  createdAt: timestamp("created_at").defaultNow(),
});

export const budgets = pgTable("budgets", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  limit: integer("limit").notNull(),
  month: text("month").notNull(),
});

export const monthlyBudgets = pgTable("monthly_budgets", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  month: text("month").notNull(),
  totalLimit: integer("total_limit").notNull(),
});

export const budgetSettings = pgTable("budget_settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  dailyLimit: integer("daily_limit"),
  weeklyLimit: integer("weekly_limit"),
});

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
