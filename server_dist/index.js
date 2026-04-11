var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express from "express";

// server/routes.ts
import { createServer } from "node:http";
import multer from "multer";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import bcrypt from "bcrypt";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Resend } from "resend";

// server/storage.ts
import { eq, and, desc, sql as sql2, inArray } from "drizzle-orm";

// server/db.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  budgetSettings: () => budgetSettings,
  budgets: () => budgets,
  expenses: () => expenses,
  insertUserSchema: () => insertUserSchema,
  monthlyBudgets: () => monthlyBudgets,
  pendingExpenses: () => pendingExpenses,
  processedSms: () => processedSms,
  users: () => users
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  emailConfirmed: boolean("email_confirmed").default(false).notNull(),
  confirmationToken: text("confirmation_token"),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  subscriptionPlan: text("subscription_plan").default("free").notNull(),
  voiceUsageCount: integer("voice_usage_count").default(0).notNull(),
  smsParsingEnabled: boolean("sms_parsing_enabled").default(false).notNull(),
  lastSmsReadTimestamp: timestamp("last_sms_read_timestamp"),
  createdAt: timestamp("created_at").defaultNow()
});
var expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  category: text("category").notNull(),
  note: text("note").default(""),
  date: text("date").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var budgets = pgTable("budgets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  limit: integer("limit").notNull(),
  month: text("month").notNull()
});
var monthlyBudgets = pgTable("monthly_budgets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  month: text("month").notNull(),
  totalLimit: integer("total_limit").notNull()
});
var budgetSettings = pgTable("budget_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  dailyLimit: integer("daily_limit"),
  weeklyLimit: integer("weekly_limit")
});
var processedSms = pgTable("processed_sms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  smsHash: text("sms_hash").notNull(),
  smsTimestamp: timestamp("sms_timestamp"),
  processedAt: timestamp("processed_at").defaultNow()
}, (table) => [
  uniqueIndex("processed_sms_user_hash_idx").on(table.userId, table.smsHash)
]);
var pendingExpenses = pgTable("pending_expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  category: text("category").notNull(),
  note: text("note").default(""),
  date: text("date").notNull(),
  smsSender: text("sms_sender"),
  smsBody: text("sms_body"),
  status: text("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  name: true
});

// server/db.ts
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}
var client = postgres(process.env.DATABASE_URL);
var db = drizzle(client, { schema: schema_exports });

// server/storage.ts
async function createUser(data) {
  const [user] = await db.insert(users).values(data).returning();
  return user;
}
async function getUserByEmail(email) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user;
}
async function getUserById(id) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user;
}
async function confirmUserEmail(token) {
  const result = await db.update(users).set({ emailConfirmed: true, confirmationToken: null }).where(eq(users.confirmationToken, token)).returning();
  return result.length > 0;
}
async function updateConfirmationToken(userId, token) {
  await db.update(users).set({ confirmationToken: token }).where(eq(users.id, userId));
}
async function setResetToken(email, token, expiry) {
  const result = await db.update(users).set({ resetToken: token, resetTokenExpiry: expiry }).where(eq(users.email, email)).returning();
  return result.length > 0;
}
async function resetPassword(token, newPassword) {
  const [user] = await db.select().from(users).where(eq(users.resetToken, token)).limit(1);
  if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < /* @__PURE__ */ new Date()) {
    return false;
  }
  await db.update(users).set({ password: newPassword, resetToken: null, resetTokenExpiry: null }).where(eq(users.id, user.id));
  return true;
}
async function getExpensesByUser(userId) {
  return await db.select().from(expenses).where(eq(expenses.userId, userId)).orderBy(desc(expenses.date), desc(expenses.createdAt));
}
async function addExpense(userId, data) {
  const [expense] = await db.insert(expenses).values({ userId, ...data }).returning();
  return expense;
}
async function updateExpenseById(userId, expenseId, data) {
  const [updated] = await db.update(expenses).set({ amount: data.amount, category: data.category, note: data.note, date: data.date }).where(and(eq(expenses.id, expenseId), eq(expenses.userId, userId))).returning();
  return updated || null;
}
async function deleteExpenseById(userId, expenseId) {
  const result = await db.delete(expenses).where(and(eq(expenses.id, expenseId), eq(expenses.userId, userId))).returning();
  return result.length > 0;
}
async function getBudgetsByUser(userId) {
  return await db.select().from(budgets).where(eq(budgets.userId, userId));
}
async function setBudgetForUser(userId, data) {
  return await db.transaction(async (tx) => {
    const existing = await tx.select().from(budgets).where(and(eq(budgets.userId, userId), eq(budgets.category, data.category), eq(budgets.month, data.month))).limit(1);
    if (existing.length > 0) {
      const [updated] = await tx.update(budgets).set({ limit: data.limit }).where(eq(budgets.id, existing[0].id)).returning();
      return updated;
    } else {
      const [budget] = await tx.insert(budgets).values({ userId, ...data }).returning();
      return budget;
    }
  });
}
async function deleteBudgetForUser(userId, category, month) {
  const result = await db.delete(budgets).where(and(eq(budgets.userId, userId), eq(budgets.category, category), eq(budgets.month, month))).returning();
  return result.length > 0;
}
async function getMonthlyBudgetsByUser(userId) {
  return await db.select().from(monthlyBudgets).where(eq(monthlyBudgets.userId, userId));
}
async function getMonthlyBudgetForUser(userId, month) {
  const [budget] = await db.select().from(monthlyBudgets).where(and(eq(monthlyBudgets.userId, userId), eq(monthlyBudgets.month, month))).limit(1);
  return budget || null;
}
async function setMonthlyBudgetForUser(userId, data) {
  return await db.transaction(async (tx) => {
    const existing = await tx.select().from(monthlyBudgets).where(and(eq(monthlyBudgets.userId, userId), eq(monthlyBudgets.month, data.month))).limit(1);
    if (existing.length > 0) {
      const [updated] = await tx.update(monthlyBudgets).set({ totalLimit: data.totalLimit }).where(eq(monthlyBudgets.id, existing[0].id)).returning();
      return updated;
    } else {
      const [budget] = await tx.insert(monthlyBudgets).values({ userId, ...data }).returning();
      return budget;
    }
  });
}
async function updateUserName(userId, name) {
  const [user] = await db.update(users).set({ name }).where(eq(users.id, userId)).returning();
  return user;
}
async function updateUserPassword(userId, hashedPassword) {
  await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));
}
async function getBudgetSettings(userId) {
  const [settings] = await db.select().from(budgetSettings).where(eq(budgetSettings.userId, userId)).limit(1);
  return settings || null;
}
async function setBudgetSettings(userId, data) {
  return await db.transaction(async (tx) => {
    const existing = await tx.select().from(budgetSettings).where(eq(budgetSettings.userId, userId)).limit(1);
    if (existing.length > 0) {
      const updateData = {};
      if (data.dailyLimit !== void 0) updateData.dailyLimit = data.dailyLimit;
      if (data.weeklyLimit !== void 0) updateData.weeklyLimit = data.weeklyLimit;
      const [updated] = await tx.update(budgetSettings).set(updateData).where(eq(budgetSettings.userId, userId)).returning();
      return updated;
    } else {
      const [created] = await tx.insert(budgetSettings).values({
        userId,
        dailyLimit: data.dailyLimit ?? null,
        weeklyLimit: data.weeklyLimit ?? null
      }).returning();
      return created;
    }
  });
}
async function deleteUserAccount(userId) {
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
async function getSubscriptionInfo(userId) {
  const [user] = await db.select({
    plan: users.subscriptionPlan,
    voiceUsageCount: users.voiceUsageCount
  }).from(users).where(eq(users.id, userId)).limit(1);
  return user || null;
}
async function updateSubscriptionPlan(userId, plan) {
  await db.update(users).set({ subscriptionPlan: plan }).where(eq(users.id, userId));
}
async function incrementVoiceUsage(userId) {
  const [updated] = await db.update(users).set({ voiceUsageCount: sql2`voice_usage_count + 1` }).where(eq(users.id, userId)).returning({ voiceUsageCount: users.voiceUsageCount });
  return updated.voiceUsageCount;
}
async function bulkCheckProcessedSms(userId, hashes) {
  if (hashes.length === 0) return /* @__PURE__ */ new Set();
  const rows = await db.select({ smsHash: processedSms.smsHash }).from(processedSms).where(and(eq(processedSms.userId, userId), inArray(processedSms.smsHash, hashes)));
  return new Set(rows.map((r) => r.smsHash));
}
async function markSmsBulkProcessed(userId, items) {
  if (items.length === 0) return;
  await db.insert(processedSms).values(
    items.map((item) => ({
      userId,
      smsHash: item.hash,
      smsTimestamp: item.timestamp ?? null
    }))
  ).onConflictDoNothing();
}
async function getPendingExpensesByUser(userId) {
  return await db.select().from(pendingExpenses).where(and(eq(pendingExpenses.userId, userId), eq(pendingExpenses.status, "pending"))).orderBy(desc(pendingExpenses.createdAt));
}
async function getPendingExpenseCount(userId) {
  const [row] = await db.select({ count: sql2`count(*)::int` }).from(pendingExpenses).where(and(eq(pendingExpenses.userId, userId), eq(pendingExpenses.status, "pending")));
  return row?.count ?? 0;
}
async function bulkAddPendingExpenses(userId, items) {
  if (items.length === 0) return [];
  return await db.insert(pendingExpenses).values(items.map((item) => ({ userId, ...item }))).returning();
}
async function updatePendingExpense(userId, pendingId, data) {
  const updateData = {};
  if (data.amount !== void 0) updateData.amount = data.amount;
  if (data.category !== void 0) updateData.category = data.category;
  if (data.note !== void 0) updateData.note = data.note;
  if (data.date !== void 0) updateData.date = data.date;
  const [updated] = await db.update(pendingExpenses).set(updateData).where(and(eq(pendingExpenses.id, pendingId), eq(pendingExpenses.userId, userId), eq(pendingExpenses.status, "pending"))).returning();
  return updated || null;
}
async function confirmPendingExpense(userId, pendingId) {
  return await db.transaction(async (tx) => {
    const [pe] = await tx.select().from(pendingExpenses).where(and(eq(pendingExpenses.id, pendingId), eq(pendingExpenses.userId, userId), eq(pendingExpenses.status, "pending"))).limit(1);
    if (!pe) return null;
    const [expense] = await tx.insert(expenses).values({
      userId,
      amount: pe.amount,
      category: pe.category,
      note: pe.note || "",
      date: pe.date
    }).returning();
    await tx.update(pendingExpenses).set({ status: "confirmed" }).where(eq(pendingExpenses.id, pendingId));
    return expense;
  });
}
async function dismissPendingExpense(userId, pendingId) {
  const [updated] = await db.update(pendingExpenses).set({ status: "dismissed" }).where(and(eq(pendingExpenses.id, pendingId), eq(pendingExpenses.userId, userId), eq(pendingExpenses.status, "pending"))).returning();
  return !!updated;
}
async function confirmAllPending(userId) {
  return await db.transaction(async (tx) => {
    const pending = await tx.select().from(pendingExpenses).where(and(eq(pendingExpenses.userId, userId), eq(pendingExpenses.status, "pending")));
    if (pending.length === 0) return [];
    const created = await tx.insert(expenses).values(
      pending.map((pe) => ({
        userId,
        amount: pe.amount,
        category: pe.category,
        note: pe.note || "",
        date: pe.date
      }))
    ).returning();
    const ids = pending.map((pe) => pe.id);
    await tx.update(pendingExpenses).set({ status: "confirmed" }).where(and(eq(pendingExpenses.userId, userId), inArray(pendingExpenses.id, ids)));
    return created;
  });
}
async function dismissAllPending(userId) {
  const result = await db.update(pendingExpenses).set({ status: "dismissed" }).where(and(eq(pendingExpenses.userId, userId), eq(pendingExpenses.status, "pending"))).returning();
  return result.length;
}
async function getSmsSettings(userId) {
  const [user] = await db.select({ smsParsingEnabled: users.smsParsingEnabled, lastSmsReadTimestamp: users.lastSmsReadTimestamp }).from(users).where(eq(users.id, userId)).limit(1);
  return user || { smsParsingEnabled: false, lastSmsReadTimestamp: null };
}
async function updateSmsParsingEnabled(userId, enabled) {
  await db.update(users).set({ smsParsingEnabled: enabled }).where(eq(users.id, userId));
}
async function updateLastSmsReadTimestamp(userId, timestamp2) {
  await db.update(users).set({ lastSmsReadTimestamp: timestamp2 }).where(eq(users.id, userId));
}

// server/routes.ts
import { randomBytes, createHash } from "crypto";
var upload = multer({ dest: "/tmp/uploads/", limits: { fileSize: 25 * 1024 * 1024 } });
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}
function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
var rateLimitStore = /* @__PURE__ */ new Map();
function rateLimit(windowMs, maxRequests) {
  return (req, res, next) => {
    const key = (req.ip || req.socket.remoteAddress || "unknown") + req.path;
    const now = Date.now();
    const entry = rateLimitStore.get(key);
    if (!entry || now > entry.resetTime) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }
    if (entry.count >= maxRequests) {
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }
    entry.count++;
    return next();
  };
}
var authLimiter = rateLimit(15 * 60 * 1e3, 15);
var voiceLimiter = rateLimit(60 * 60 * 1e3, 30);
var smsLimiter = rateLimit(60 * 60 * 1e3, 20);
var VALID_CATEGORY_KEYS = [
  "kiryana",
  "bijliBill",
  "gasBill",
  "paniBill",
  "schoolFees",
  "transport",
  "medical",
  "chaiNashta",
  "kapray",
  "rent",
  "general"
];
async function sendConfirmationEmail(email, token, requestHost) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.warn("RESEND_API_KEY not configured, skipping confirmation email");
    return;
  }
  const resend = new Resend(resendApiKey);
  let appUrl;
  if (process.env.APP_URL) {
    appUrl = process.env.APP_URL;
  } else if (requestHost) {
    const protocol = requestHost.includes("localhost") ? "http" : "https";
    appUrl = `${protocol}://${requestHost}`;
  } else {
    appUrl = "http://localhost:5000";
  }
  const confirmUrl = `${appUrl}/api/auth/confirm-email?token=${token}`;
  const emailHtml = `
    <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #F8F9FB;">
      <div style="background: white; border-radius: 16px; padding: 32px 24px; border: 1px solid #E2E6ED;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="width: 56px; height: 56px; background: #1E3A5F; border-radius: 16px; display: inline-flex; align-items: center; justify-content: center;">
            <span style="color: white; font-size: 24px; font-weight: bold;">H</span>
          </div>
          <h1 style="margin: 16px 0 4px; font-size: 22px; color: #1a1a1a;">Welcome to Hisaabit</h1>
          <p style="color: #6b7280; font-size: 14px; margin: 0;">Confirm your email to get started</p>
        </div>
        <p style="color: #374151; font-size: 14px; line-height: 22px;">
          Please click the button below to verify your email address and activate your account.
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${confirmUrl}" style="background: #1E3A5F; color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 15px; display: inline-block;">
            Confirm Email
          </a>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">
          If you didn't create a Hisaabit account, you can safely ignore this email.
        </p>
      </div>
    </div>
  `;
  const { data, error } = await resend.emails.send({
    from: "Hisaabit <onboarding@resend.dev>",
    to: [email],
    subject: "Confirm your Hisaabit account",
    html: emailHtml
  });
  if (error) {
    console.error("Resend email error:", error);
    throw new Error(`Failed to send confirmation email: ${error.message}`);
  }
  console.log("Confirmation email sent via Resend:", data?.id);
}
var CATEGORIES = [
  { key: "kiryana", label: "Grocery", aliases: ["grocery", "groceries", "kiryana", "ration", "general store", "dukan", "sabzi", "vegetables", "fruit", "mandi", "sabzi mandi", "phal"] },
  { key: "bijliBill", label: "Bijli Bill", aliases: ["bijli", "electricity", "light bill", "wapda", "electric"] },
  { key: "gasBill", label: "Gas Bill", aliases: ["gas", "sui gas", "gas bill", "sui northern", "sui southern"] },
  { key: "paniBill", label: "Pani Bill", aliases: ["pani", "water", "water bill"] },
  { key: "schoolFees", label: "School Fees", aliases: ["school", "fees", "tuition", "academy", "school fees", "coaching", "tution"] },
  { key: "transport", label: "Transport", aliases: ["transport", "petrol", "diesel", "rickshaw", "uber", "careem", "bus", "fuel", "cng"] },
  { key: "medical", label: "Medical", aliases: ["medical", "doctor", "hospital", "medicine", "dawai", "pharmacy", "clinic", "lab test"] },
  { key: "chaiNashta", label: "Food", aliases: ["chai", "tea", "nashta", "breakfast", "restaurant", "hotel", "dhaba", "khana", "lunch", "dinner", "food", "biryani", "pizza"] },
  { key: "kapray", label: "Shopping", aliases: ["kapray", "clothes", "kapra", "shoes", "joota", "shopping", "dress"] },
  { key: "rent", label: "Rent", aliases: ["rent", "kiraya", "house rent", "ghar ka kiraya"] },
  { key: "general", label: "General", aliases: ["general", "other", "misc"] }
];
async function registerRoutes(app2) {
  const PgSession = connectPgSimple(session);
  const isProduction = process.env.NODE_ENV === "production";
  if (!process.env.SESSION_SECRET) {
    if (isProduction) {
      throw new Error("SESSION_SECRET environment variable is required in production");
    }
    console.warn("WARNING: SESSION_SECRET not set \u2014 using insecure fallback. Set it in .env for production.");
  }
  app2.use(
    session({
      store: new PgSession({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true
      }),
      secret: process.env.SESSION_SECRET || "hisaabit-dev-fallback-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: isProduction,
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1e3,
        sameSite: "lax"
      }
    })
  );
  app2.post("/api/auth/register", authLimiter, async (req, res) => {
    try {
      const { email, password, name } = req.body;
      if (!email || !password || !name) {
        return res.status(400).json({ error: "Name, email and password are required" });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Please enter a valid email address" });
      }
      const existing = await getUserByEmail(email.toLowerCase().trim());
      if (existing) {
        return res.status(409).json({ error: "An account with this email already exists" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const confirmationToken = randomBytes(32).toString("hex");
      await createUser({
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        name: name.trim(),
        confirmationToken
      });
      let emailSent = false;
      try {
        await sendConfirmationEmail(email.toLowerCase().trim(), confirmationToken, req.get("host"));
        emailSent = true;
      } catch (err) {
        console.error("Failed to send confirmation email:", err);
      }
      return res.json({
        message: emailSent ? "Account created! Please check your email to confirm your account before logging in." : "Account created! We couldn't send a confirmation email right now. Please use the 'Resend' option on the login screen.",
        requiresConfirmation: true
      });
    } catch (err) {
      console.error("Register error:", err);
      return res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });
  app2.get("/api/auth/confirm-email", async (req, res) => {
    try {
      const { token } = req.query;
      if (!token || typeof token !== "string") {
        return res.status(400).send(confirmationPage(false, "Invalid confirmation link."));
      }
      const confirmed = await confirmUserEmail(token);
      if (confirmed) {
        return res.send(confirmationPage(true, "Your email has been confirmed! You can now log in to the app."));
      } else {
        return res.send(confirmationPage(false, "This confirmation link is invalid or has already been used."));
      }
    } catch (err) {
      console.error("Email confirmation error:", err);
      return res.status(500).send(confirmationPage(false, "Something went wrong. Please try again."));
    }
  });
  app2.post("/api/auth/login", authLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      const user = await getUserByEmail(email.toLowerCase().trim());
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      if (!user.emailConfirmed) {
        return res.status(403).json({
          error: "Please confirm your email address before logging in. Check your inbox for the confirmation link.",
          needsConfirmation: true
        });
      }
      req.session.userId = user.id;
      return res.json({ user: { id: user.id, email: user.email, name: user.name, subscriptionPlan: user.subscriptionPlan || "free", voiceUsageCount: user.voiceUsageCount || 0 } });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });
  app2.post("/api/auth/resend-confirmation", authLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      const user = await getUserByEmail(email.toLowerCase().trim());
      if (!user) {
        return res.json({ message: "If an account exists, we've resent the confirmation email." });
      }
      if (user.emailConfirmed) {
        return res.json({ message: "Your email is already confirmed. You can log in." });
      }
      const newToken = randomBytes(32).toString("hex");
      await updateConfirmationToken(user.id, newToken);
      try {
        await sendConfirmationEmail(email.toLowerCase().trim(), newToken, req.get("host"));
      } catch (err) {
        console.error("Failed to resend confirmation email:", err);
      }
      return res.json({ message: "If an account exists, we've resent the confirmation email." });
    } catch (err) {
      console.error("Resend confirmation error:", err);
      return res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });
  app2.post("/api/auth/forgot-password", authLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      const token = randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 60 * 60 * 1e3);
      await setResetToken(email.toLowerCase().trim(), token, expiry);
      return res.json({ message: "If an account with that email exists, we've sent password reset instructions." });
    } catch (err) {
      console.error("Forgot password error:", err);
      return res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });
  app2.post("/api/auth/reset-password", authLimiter, async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ error: "Token and new password are required" });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const success = await resetPassword(token, hashedPassword);
      if (!success) {
        return res.status(400).json({ error: "Invalid or expired reset link" });
      }
      return res.json({ message: "Password has been reset successfully" });
    } catch (err) {
      console.error("Reset password error:", err);
      return res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });
  app2.get("/api/auth/me", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const user = await getUserById(req.session.userId);
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      return res.json({ user: { id: user.id, email: user.email, name: user.name, subscriptionPlan: user.subscriptionPlan || "free", voiceUsageCount: user.voiceUsageCount || 0 } });
    } catch (err) {
      console.error("Auth check error:", err);
      return res.status(500).json({ error: "Something went wrong" });
    }
  });
  app2.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Could not log out" });
      }
      res.clearCookie("connect.sid");
      return res.json({ message: "Logged out" });
    });
  });
  app2.put("/api/auth/profile", requireAuth, async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Name is required" });
      }
      const user = await updateUserName(req.session.userId, name.trim());
      return res.json({ user: { id: user.id, email: user.email, name: user.name, subscriptionPlan: user.subscriptionPlan || "free", voiceUsageCount: user.voiceUsageCount || 0 } });
    } catch (err) {
      console.error("Update profile error:", err);
      return res.status(500).json({ error: "Failed to update profile" });
    }
  });
  app2.put("/api/auth/password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current password and new password are required" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters" });
      }
      const user = await getUserById(req.session.userId);
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await updateUserPassword(req.session.userId, hashedPassword);
      return res.json({ message: "Password updated successfully" });
    } catch (err) {
      console.error("Change password error:", err);
      return res.status(500).json({ error: "Failed to change password" });
    }
  });
  app2.delete("/api/auth/account", requireAuth, async (req, res) => {
    try {
      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ error: "Password is required" });
      }
      const user = await getUserById(req.session.userId);
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(400).json({ error: "Password is incorrect" });
      }
      await deleteUserAccount(req.session.userId);
      req.session.destroy((err) => {
        if (err) {
          console.error("Session destroy error:", err);
        }
        res.clearCookie("connect.sid");
        return res.json({ message: "Account deleted" });
      });
    } catch (err) {
      console.error("Delete account error:", err);
      return res.status(500).json({ error: "Failed to delete account" });
    }
  });
  app2.get("/api/auth/export", requireAuth, async (req, res) => {
    try {
      const user = await getUserById(req.session.userId);
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const userExpenses = await getExpensesByUser(req.session.userId);
      const userBudgets = await getBudgetsByUser(req.session.userId);
      const userMonthlyBudgets = await getMonthlyBudgetsByUser(req.session.userId);
      return res.json({
        user: { name: user.name, email: user.email },
        expenses: userExpenses,
        budgets: userBudgets,
        monthlyBudgets: userMonthlyBudgets
      });
    } catch (err) {
      console.error("Export data error:", err);
      return res.status(500).json({ error: "Failed to export data" });
    }
  });
  app2.get("/api/expenses", requireAuth, async (req, res) => {
    try {
      const expenses2 = await getExpensesByUser(req.session.userId);
      return res.json(expenses2);
    } catch (err) {
      console.error("Get expenses error:", err);
      return res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });
  app2.post("/api/expenses", requireAuth, async (req, res) => {
    try {
      const { amount, category, note, date } = req.body;
      if (!amount || !category || !date) {
        return res.status(400).json({ error: "Amount, category and date are required" });
      }
      if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0 || amount > 1e8) {
        return res.status(400).json({ error: "Amount must be a positive integer (max 100,000,000)" });
      }
      if (!VALID_CATEGORY_KEYS.includes(category)) {
        return res.status(400).json({ error: "Invalid category" });
      }
      const expense = await addExpense(req.session.userId, { amount, category, note: note || "", date });
      return res.json(expense);
    } catch (err) {
      console.error("Add expense error:", err);
      return res.status(500).json({ error: "Failed to add expense" });
    }
  });
  app2.put("/api/expenses/:id", requireAuth, async (req, res) => {
    try {
      const { amount, category, note, date } = req.body;
      if (!amount || !category || !date) {
        return res.status(400).json({ error: "Amount, category and date are required" });
      }
      if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0 || amount > 1e8) {
        return res.status(400).json({ error: "Amount must be a positive integer (max 100,000,000)" });
      }
      if (!VALID_CATEGORY_KEYS.includes(category)) {
        return res.status(400).json({ error: "Invalid category" });
      }
      const updated = await updateExpenseById(req.session.userId, req.params.id, {
        amount,
        category,
        note: note || "",
        date
      });
      if (!updated) {
        return res.status(404).json({ error: "Expense not found" });
      }
      return res.json(updated);
    } catch (err) {
      console.error("Update expense error:", err);
      return res.status(500).json({ error: "Failed to update expense" });
    }
  });
  app2.delete("/api/expenses/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await deleteExpenseById(req.session.userId, req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Expense not found" });
      }
      return res.json({ message: "Deleted" });
    } catch (err) {
      console.error("Delete expense error:", err);
      return res.status(500).json({ error: "Failed to delete expense" });
    }
  });
  app2.get("/api/budgets", requireAuth, async (req, res) => {
    try {
      const budgets2 = await getBudgetsByUser(req.session.userId);
      return res.json(budgets2);
    } catch (err) {
      console.error("Get budgets error:", err);
      return res.status(500).json({ error: "Failed to fetch budgets" });
    }
  });
  app2.post("/api/budgets", requireAuth, async (req, res) => {
    try {
      const { category, limit, month } = req.body;
      if (!category || !limit || !month) {
        return res.status(400).json({ error: "Category, limit and month are required" });
      }
      if (!VALID_CATEGORY_KEYS.includes(category)) {
        return res.status(400).json({ error: "Invalid category" });
      }
      const budget = await setBudgetForUser(req.session.userId, { category, limit, month });
      return res.json(budget);
    } catch (err) {
      console.error("Set budget error:", err);
      return res.status(500).json({ error: "Failed to set budget" });
    }
  });
  app2.delete("/api/budgets/:category/:month", requireAuth, async (req, res) => {
    try {
      const deleted = await deleteBudgetForUser(req.session.userId, req.params.category, req.params.month);
      if (!deleted) {
        return res.status(404).json({ error: "Budget not found" });
      }
      return res.json({ message: "Deleted" });
    } catch (err) {
      console.error("Delete budget error:", err);
      return res.status(500).json({ error: "Failed to delete budget" });
    }
  });
  app2.get("/api/monthly-budgets", requireAuth, async (req, res) => {
    try {
      const budgets2 = await getMonthlyBudgetsByUser(req.session.userId);
      return res.json(budgets2);
    } catch (err) {
      console.error("Get monthly budgets error:", err);
      return res.status(500).json({ error: "Failed to fetch monthly budgets" });
    }
  });
  app2.get("/api/monthly-budgets/:month", requireAuth, async (req, res) => {
    try {
      const budget = await getMonthlyBudgetForUser(req.session.userId, req.params.month);
      return res.json(budget);
    } catch (err) {
      console.error("Get monthly budget error:", err);
      return res.status(500).json({ error: "Failed to fetch monthly budget" });
    }
  });
  app2.post("/api/monthly-budgets", requireAuth, async (req, res) => {
    try {
      const { month, totalLimit } = req.body;
      if (!month || !totalLimit) {
        return res.status(400).json({ error: "Month and totalLimit are required" });
      }
      const budget = await setMonthlyBudgetForUser(req.session.userId, { month, totalLimit });
      return res.json(budget);
    } catch (err) {
      console.error("Set monthly budget error:", err);
      return res.status(500).json({ error: "Failed to set monthly budget" });
    }
  });
  app2.get("/api/budget-settings", requireAuth, async (req, res) => {
    try {
      const settings = await getBudgetSettings(req.session.userId);
      return res.json(settings);
    } catch (err) {
      console.error("Get budget settings error:", err);
      return res.status(500).json({ error: "Failed to fetch budget settings" });
    }
  });
  app2.put("/api/budget-settings", requireAuth, async (req, res) => {
    try {
      const { dailyLimit, weeklyLimit } = req.body;
      const settings = await setBudgetSettings(req.session.userId, { dailyLimit, weeklyLimit });
      return res.json(settings);
    } catch (err) {
      console.error("Set budget settings error:", err);
      return res.status(500).json({ error: "Failed to save budget settings" });
    }
  });
  app2.get("/api/subscription", requireAuth, async (req, res) => {
    try {
      const info = await getSubscriptionInfo(req.session.userId);
      if (!info) {
        return res.status(404).json({ error: "User not found" });
      }
      return res.json(info);
    } catch (err) {
      console.error("Get subscription error:", err);
      return res.status(500).json({ error: "Failed to get subscription info" });
    }
  });
  app2.put("/api/subscription", requireAuth, async (req, res) => {
    try {
      const { plan } = req.body;
      if (!plan || !["free", "pro"].includes(plan)) {
        return res.status(400).json({ error: "Invalid plan" });
      }
      await updateSubscriptionPlan(req.session.userId, plan);
      const info = await getSubscriptionInfo(req.session.userId);
      return res.json(info);
    } catch (err) {
      console.error("Update subscription error:", err);
      return res.status(500).json({ error: "Failed to update subscription" });
    }
  });
  app2.post("/api/voice-expense", voiceLimiter, upload.single("audio"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const subInfo = await getSubscriptionInfo(req.session.userId);
      const plan = subInfo?.plan || "free";
      const voiceUsageCount = subInfo?.voiceUsageCount || 0;
      if (plan === "free" && voiceUsageCount >= 10) {
        return res.status(403).json({ error: "You've used all 10 free AI voice entries. Upgrade to Pro for unlimited voice expense logging.", code: "VOICE_LIMIT_REACHED" });
      }
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "OpenAI API key not configured" });
      }
      const openai = new OpenAI({ apiKey });
      const audioPath = req.file.path;
      const originalName = req.file.originalname || "recording.m4a";
      const ext = path.extname(originalName).toLowerCase() || ".m4a";
      const supportedExts = [".flac", ".m4a", ".mp3", ".mp4", ".mpeg", ".mpga", ".oga", ".ogg", ".wav", ".webm"];
      const finalExt = supportedExts.includes(ext) ? ext : ".m4a";
      const renamedPath = audioPath + finalExt;
      fs.renameSync(audioPath, renamedPath);
      const audioFile = fs.createReadStream(renamedPath);
      const transcription = await openai.audio.transcriptions.create({
        model: "whisper-1",
        file: audioFile,
        language: "ur",
        prompt: "This is a Pakistani household expense spoken in Urdu or Roman Urdu or English. It may contain amounts in Pakistani Rupees (PKR). Common words: rupay, hazaar, sau, kiryana, sabzi, bijli, gas, school, petrol, chai, nashta, kapray, dawai, rent, kiraya."
      });
      try {
        fs.unlinkSync(renamedPath);
      } catch {
      }
      ;
      const transcript = transcription.text;
      if (!transcript || transcript.trim().length === 0) {
        return res.status(400).json({ error: "Could not understand the audio. Please try again." });
      }
      const categoryList = CATEGORIES.map((c) => `"${c.key}" (${c.label})`).join(", ");
      const extraction = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `You extract expense details from Pakistani household expense descriptions. The user speaks in Urdu, Roman Urdu, or English. A single message may mention MULTIPLE separate expenses \u2014 you must extract ALL of them. Today's date is ${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.

For EACH expense, extract:
1. amount: The amount in PKR (Pakistani Rupees). Convert words like "hazaar" (thousand), "sau" (hundred), "lakh" to numbers. "paanch sau" = 500, "do hazaar" = 2000, "teen sau pachaas" = 350.
2. category: One of these exact keys: ${categoryList}. Match based on context.
3. note: A brief description of the expense in English.
4. date: The date the expense was made as an ISO date string (YYYY-MM-DD). Interpret relative dates like "kal" / "yesterday", "parso" / "day before yesterday", "aaj" / "today", "pichle hafte" / "last week", "Monday", etc. relative to today. If no date is mentioned, use today's date.

ALWAYS respond with a JSON array, even for a single expense:
[{"amount": number, "category": "key", "note": "description", "date": "YYYY-MM-DD"}]

Examples:
- "kiryana ka saman liya paanch sau ka aur bijli ka bill do hazaar tha" \u2192 [{"amount":500,"category":"kiryana","note":"Grocery shopping","date":"${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}"},{"amount":2000,"category":"bijliBill","note":"Electricity bill","date":"${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}"}]
- "kal chai pi teen sau ki" \u2192 [{"amount":300,"category":"chaiNashta","note":"Tea","date":"${(() => {
              const d = /* @__PURE__ */ new Date();
              d.setDate(d.getDate() - 1);
              return d.toISOString().split("T")[0];
            })()}"}]

If you cannot determine the amount for an expense, use 0. If you cannot determine the category, use "general". If no date is mentioned, use today's date.`
          },
          {
            role: "user",
            content: transcript
          }
        ]
      });
      const content = extraction.choices[0]?.message?.content || "";
      let expenses2;
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          expenses2 = JSON.parse(jsonMatch[0]);
        } else {
          const objMatch = content.match(/\{[\s\S]*\}/);
          if (!objMatch) throw new Error("No JSON found");
          expenses2 = [JSON.parse(objMatch[0])];
        }
        if (!Array.isArray(expenses2)) {
          expenses2 = [expenses2];
        }
      } catch {
        expenses2 = [{ amount: 0, category: "general", note: transcript }];
      }
      const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const validatedExpenses = expenses2.map((e) => {
        const validCategory = CATEGORIES.find((c) => c.key === e.category);
        let dateStr = todayStr;
        if (e.date && /^\d{4}-\d{2}-\d{2}$/.test(e.date)) {
          dateStr = e.date;
        }
        return {
          amount: Math.max(0, Math.round(e.amount || 0)),
          category: validCategory ? e.category : "general",
          note: e.note || "",
          date: dateStr
        };
      });
      let finalExpenses = validatedExpenses;
      if (plan === "free") {
        finalExpenses = validatedExpenses.slice(0, 1);
      }
      if (finalExpenses.length > 0 && finalExpenses.some((e) => e.amount > 0)) {
        await incrementVoiceUsage(req.session.userId);
      }
      return res.json({
        transcript,
        expenses: finalExpenses,
        plan
      });
    } catch (err) {
      console.error("Voice expense error:", err);
      return res.status(500).json({ error: "Failed to process voice note. Please try again." });
    }
  });
  app2.post("/api/sms/process", smsLimiter, requireAuth, async (req, res) => {
    try {
      const { messages } = req.body;
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "No messages provided" });
      }
      const capped = messages.slice(0, 50);
      const hashMap = capped.map((m) => ({
        ...m,
        hash: createHash("sha256").update(`${m.sender}|${m.body}|${m.timestamp}`).digest("hex")
      }));
      const alreadyProcessed = await bulkCheckProcessedSms(req.session.userId, hashMap.map((h) => h.hash));
      const newMessages = hashMap.filter((h) => !alreadyProcessed.has(h.hash));
      if (newMessages.length === 0) {
        return res.json({ processed: 0, pending: 0, skipped: capped.length });
      }
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "OpenAI API key not configured" });
      }
      const openai = new OpenAI({ apiKey });
      const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const categoryList = CATEGORIES.map((c) => `"${c.key}" (${c.label})`).join(", ");
      const smsArray = newMessages.map((m, i) => ({
        index: i,
        sender: m.sender,
        body: m.body
      }));
      const extraction = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `You extract expense details from Pakistani bank transaction SMS messages.
Today's date is ${todayStr}.

For each SMS, extract:
1. amount: Transaction amount in PKR (integer). Parse from formats like "Rs.2,500", "PKR 1500", "Rs 500.00", "amount: 3,000".
2. category: One of these exact keys: ${categoryList}.
   Categorize based on merchant name or description:
   - Supermarkets/grocery stores (Imtiaz, Metro, Al-Fatah, Chase Up) -> "kiryana"
   - Fuel stations (PSO, Shell, Total, Attock) -> "transport"
   - Restaurants/food chains (KFC, McDonald's, Dominos, dhabas) -> "chaiNashta"
   - Pharmacies (Fazal Din, D.Watson, Servaid) -> "medical"
   - Clothing stores (Khaadi, Gul Ahmed, Sapphire, Alkaram) -> "kapray"
   - Utility bills (WAPDA, K-Electric, SSGC, SNGPL) -> match specific bill category
   - School/academy/tuition payments -> "schoolFees"
   - Rent/house payments -> "rent"
   - ATM withdrawals or general POS -> "general"
   - If merchant unclear -> "general"
3. note: Brief English description. Include merchant name if available. Example: "Purchase at Imtiaz Supermarket" or "ATM withdrawal" or "Transfer to Ali".
4. date: Extract date from SMS if present (YYYY-MM-DD). If not in SMS, use today's date.
5. type: "debit" or "credit". Only debit transactions become expenses.

Respond with ONLY a JSON array (one object per SMS that is a debit transaction):
[{"amount": number, "category": "key", "note": "description", "date": "YYYY-MM-DD", "type": "debit", "smsIndex": 0}]

Important:
- Only return DEBIT transactions (purchases, payments, withdrawals, transfers sent). Skip credit/incoming transactions entirely.
- Parse Pakistani number formats: "2,500" = 2500, "1.5K" = 1500, "50,000.00" = 50000
- Round to nearest integer (no decimals)
- If amount cannot be determined, skip that SMS entirely
- smsIndex corresponds to the "index" field in the input array`
          },
          {
            role: "user",
            content: JSON.stringify(smsArray)
          }
        ]
      });
      const content = extraction.choices[0]?.message?.content || "[]";
      let parsed;
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        if (!Array.isArray(parsed)) parsed = [];
      } catch {
        parsed = [];
      }
      const pendingItems = parsed.filter((e) => e.type === "debit" && e.amount > 0 && e.smsIndex >= 0 && e.smsIndex < newMessages.length).map((e) => {
        const validCategory = VALID_CATEGORY_KEYS.includes(e.category) ? e.category : "general";
        const dateStr = e.date && /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : todayStr;
        const sourceMsg = newMessages[e.smsIndex];
        return {
          amount: Math.round(e.amount),
          category: validCategory,
          note: e.note || "",
          date: dateStr,
          smsSender: sourceMsg?.sender || void 0,
          smsBody: sourceMsg?.body || void 0
        };
      });
      const created = await bulkAddPendingExpenses(req.session.userId, pendingItems);
      await markSmsBulkProcessed(
        req.session.userId,
        newMessages.map((m) => ({
          hash: m.hash,
          timestamp: m.timestamp ? new Date(m.timestamp) : void 0
        }))
      );
      await updateLastSmsReadTimestamp(req.session.userId, /* @__PURE__ */ new Date());
      return res.json({
        processed: newMessages.length,
        pending: created.length,
        skipped: capped.length - newMessages.length
      });
    } catch (err) {
      console.error("SMS process error:", err);
      return res.status(500).json({ error: "Failed to process SMS messages" });
    }
  });
  app2.get("/api/sms/pending", requireAuth, async (req, res) => {
    try {
      const pending = await getPendingExpensesByUser(req.session.userId);
      return res.json(pending);
    } catch (err) {
      console.error("Get pending SMS error:", err);
      return res.status(500).json({ error: "Failed to get pending expenses" });
    }
  });
  app2.get("/api/sms/pending/count", requireAuth, async (req, res) => {
    try {
      const count = await getPendingExpenseCount(req.session.userId);
      return res.json({ count });
    } catch (err) {
      console.error("Get pending count error:", err);
      return res.status(500).json({ error: "Failed to get pending count" });
    }
  });
  app2.put("/api/sms/pending/:id", requireAuth, async (req, res) => {
    try {
      const { amount, category, note, date } = req.body;
      if (category && !VALID_CATEGORY_KEYS.includes(category)) {
        return res.status(400).json({ error: "Invalid category" });
      }
      if (amount !== void 0 && (typeof amount !== "number" || amount <= 0)) {
        return res.status(400).json({ error: "Amount must be a positive number" });
      }
      const updated = await updatePendingExpense(req.session.userId, req.params.id, { amount, category, note, date });
      if (!updated) return res.status(404).json({ error: "Pending expense not found" });
      return res.json(updated);
    } catch (err) {
      console.error("Update pending error:", err);
      return res.status(500).json({ error: "Failed to update pending expense" });
    }
  });
  app2.post("/api/sms/pending/:id/confirm", requireAuth, async (req, res) => {
    try {
      const expense = await confirmPendingExpense(req.session.userId, req.params.id);
      if (!expense) return res.status(404).json({ error: "Pending expense not found" });
      return res.json(expense);
    } catch (err) {
      console.error("Confirm pending error:", err);
      return res.status(500).json({ error: "Failed to confirm expense" });
    }
  });
  app2.post("/api/sms/pending/:id/dismiss", requireAuth, async (req, res) => {
    try {
      const dismissed = await dismissPendingExpense(req.session.userId, req.params.id);
      if (!dismissed) return res.status(404).json({ error: "Pending expense not found" });
      return res.json({ message: "Dismissed" });
    } catch (err) {
      console.error("Dismiss pending error:", err);
      return res.status(500).json({ error: "Failed to dismiss expense" });
    }
  });
  app2.post("/api/sms/pending/confirm-all", requireAuth, async (req, res) => {
    try {
      const created = await confirmAllPending(req.session.userId);
      return res.json({ confirmed: created.length, expenses: created });
    } catch (err) {
      console.error("Confirm all error:", err);
      return res.status(500).json({ error: "Failed to confirm all expenses" });
    }
  });
  app2.post("/api/sms/pending/dismiss-all", requireAuth, async (req, res) => {
    try {
      const count = await dismissAllPending(req.session.userId);
      return res.json({ dismissed: count });
    } catch (err) {
      console.error("Dismiss all error:", err);
      return res.status(500).json({ error: "Failed to dismiss all expenses" });
    }
  });
  app2.get("/api/sms/settings", requireAuth, async (req, res) => {
    try {
      const settings = await getSmsSettings(req.session.userId);
      return res.json({
        smsParsingEnabled: settings.smsParsingEnabled,
        lastSmsReadTimestamp: settings.lastSmsReadTimestamp?.toISOString() || null
      });
    } catch (err) {
      console.error("Get SMS settings error:", err);
      return res.status(500).json({ error: "Failed to get SMS settings" });
    }
  });
  app2.put("/api/sms/settings", requireAuth, async (req, res) => {
    try {
      const { smsParsingEnabled } = req.body;
      if (typeof smsParsingEnabled !== "boolean") {
        return res.status(400).json({ error: "smsParsingEnabled must be a boolean" });
      }
      await updateSmsParsingEnabled(req.session.userId, smsParsingEnabled);
      return res.json({ smsParsingEnabled });
    } catch (err) {
      console.error("Update SMS settings error:", err);
      return res.status(500).json({ error: "Failed to update SMS settings" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}
function confirmationPage(success, message) {
  const safeMessage = escapeHtml(message);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Confirmation - Hisaabit</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #F8F9FA; color: #1A1A2E; }
    .container { text-align: center; padding: 40px; max-width: 400px; background: white; border-radius: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .icon { width: 72px; height: 72px; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 32px; }
    .success { background: rgba(13, 107, 63, 0.08); }
    .error { background: rgba(239, 68, 68, 0.08); }
    h1 { font-size: 22px; margin: 0 0 12px; }
    p { font-size: 15px; color: #6B7280; line-height: 1.6; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon ${success ? "success" : "error"}">${success ? "&#10003;" : "&#10005;"}</div>
    <h1>${success ? "Email Confirmed!" : "Confirmation Failed"}</h1>
    <p>${safeMessage}</p>
  </div>
</body>
</html>`;
}

// server/index.ts
import * as fs2 from "fs";
import * as path2 from "path";
var app = express();
app.set("trust proxy", 1);
var log = console.log;
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }
    const origin = req.header("origin");
    const isLocalhost = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path3 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path3.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path2.resolve(process.cwd(), "app.json");
    const appJsonContent = fs2.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, res) {
  const manifestPath = path2.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs2.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs2.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}
function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);
  const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl).replace(/EXPS_URL_PLACEHOLDER/g, expsUrl).replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function configureExpoAndLanding(app2) {
  const templatePath = path2.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  const landingPageTemplate = fs2.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  log("Serving static Expo files with dynamic manifest routing");
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }
    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName
      });
    }
    next();
  });
  app2.use("/assets", express.static(path2.resolve(process.cwd(), "assets")));
  app2.use(express.static(path2.resolve(process.cwd(), "static-build")));
  log("Expo routing: Checking expo-platform header on / and /manifest");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
}
(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  configureExpoAndLanding(app);
  const server = await registerRoutes(app);
  setupErrorHandler(app);
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0"
    },
    () => {
      log(`express server serving on port ${port}`);
    }
  );
})();
