import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import multer from "multer";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import bcrypt from "bcrypt";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Resend } from "resend";
import {
  createUser,
  getUserByEmail,
  getUserById,
  setResetToken,
  resetPassword,
  confirmUserEmail,
  updateConfirmationToken,
  getExpensesByUser,
  addExpense,
  updateExpenseById,
  deleteExpenseById,
  getBudgetsByUser,
  setBudgetForUser,
  deleteBudgetForUser,
  getMonthlyBudgetsByUser,
  getMonthlyBudgetForUser,
  setMonthlyBudgetForUser,
  deleteMonthlyBudgetForUser,
  getBudgetSettings,
  setBudgetSettings,
  updateUserName,
  updateUserPassword,
  markUserDemoSeen,
  deleteUserAccount,
  getSubscriptionInfo,
  updateSubscriptionPlan,
  purchaseAdRemoval,
  purchaseVoiceCredits,
  bulkCheckProcessedSms,
  markSmsBulkProcessed,
  getPendingExpensesByUser,
  getPendingExpenseCount,
  bulkAddPendingExpenses,
  updatePendingExpense,
  confirmPendingExpense,
  dismissPendingExpense,
  confirmAllPending,
  dismissAllPending,
  getSmsSettings,
  updateSmsParsingEnabled,
  updateLastSmsReadTimestamp,
} from "./storage";
import { randomBytes, createHash } from "crypto";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

const upload = multer({ dest: "/tmp/uploads/", limits: { fileSize: 25 * 1024 * 1024 } });

function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function rateLimit(windowMs: number, maxRequests: number) {
  return (req: Request, res: Response, next: Function) => {
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

const authLimiter = rateLimit(15 * 60 * 1000, 15);
const voiceLimiter = rateLimit(60 * 60 * 1000, 30);
const smsLimiter = rateLimit(60 * 60 * 1000, 20);

const VALID_CATEGORY_KEYS = [
  "kiryana", "bijliBill", "gasBill", "paniBill",
  "schoolFees", "transport", "medical",
  "chaiNashta", "kapray", "rent", "general",
];

async function sendConfirmationEmail(email: string, token: string, requestHost?: string) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.warn("RESEND_API_KEY not configured, skipping confirmation email");
    return;
  }

  const resend = new Resend(resendApiKey);

  let appUrl: string;
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
    html: emailHtml,
  });

  if (error) {
    console.error("Resend email error:", error);
    throw new Error(`Failed to send confirmation email: ${error.message}`);
  }

  console.log("Confirmation email sent via Resend:", data?.id);
}

const CATEGORIES = [
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
  { key: "general", label: "General", aliases: ["general", "other", "misc"] },
];

export async function registerRoutes(app: Express): Promise<Server> {
  const PgSession = connectPgSimple(session);
  const isProduction = process.env.NODE_ENV === "production";

  if (!process.env.SESSION_SECRET) {
    if (isProduction) {
      throw new Error("SESSION_SECRET environment variable is required in production");
    }
    console.warn("WARNING: SESSION_SECRET not set — using insecure fallback. Set it in .env for production.");
  }

  app.use(
    session({
      store: new PgSession({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "hisaabit-dev-fallback-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: isProduction,
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: "lax",
      },
    })
  );

  app.post("/api/auth/register", authLimiter, async (req: Request, res: Response) => {
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
        confirmationToken,
      });

      let emailSent = false;
      try {
        await sendConfirmationEmail(email.toLowerCase().trim(), confirmationToken, req.get("host"));
        emailSent = true;
      } catch (err: any) {
        console.error("Failed to send confirmation email:", err);
      }

      return res.json({
        message: emailSent
          ? "Account created! Please check your email to confirm your account before logging in."
          : "Account created! We couldn't send a confirmation email right now. Please use the 'Resend' option on the login screen.",
        requiresConfirmation: true,
      });
    } catch (err) {
      console.error("Register error:", err);
      return res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  app.get("/api/auth/confirm-email", async (req: Request, res: Response) => {
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

  app.post("/api/auth/login", authLimiter, async (req: Request, res: Response) => {
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
          needsConfirmation: true,
        });
      }

      req.session.userId = user.id;
      return res.json({ user: { id: user.id, email: user.email, name: user.name, subscriptionPlan: user.subscriptionPlan || 'free', voiceUsageCount: user.voiceUsageCount || 0, adsRemoved: user.adsRemoved || false, voiceCreditsPurchased: user.voiceCreditsPurchased || 0, hasSeenDemo: user.hasSeenDemo || false } });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  app.post("/api/auth/resend-confirmation", authLimiter, async (req: Request, res: Response) => {
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

  app.post("/api/auth/forgot-password", authLimiter, async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const token = randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 60 * 60 * 1000);
      await setResetToken(email.toLowerCase().trim(), token, expiry);

      return res.json({ message: "If an account with that email exists, we've sent password reset instructions." });
    } catch (err) {
      console.error("Forgot password error:", err);
      return res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  app.post("/api/auth/reset-password", authLimiter, async (req: Request, res: Response) => {
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

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await getUserById(req.session.userId);
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      return res.json({ user: { id: user.id, email: user.email, name: user.name, subscriptionPlan: user.subscriptionPlan || 'free', voiceUsageCount: user.voiceUsageCount || 0, adsRemoved: user.adsRemoved || false, voiceCreditsPurchased: user.voiceCreditsPurchased || 0, hasSeenDemo: user.hasSeenDemo || false } });
    } catch (err) {
      console.error("Auth check error:", err);
      return res.status(500).json({ error: "Something went wrong" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Could not log out" });
      }
      res.clearCookie("connect.sid");
      return res.json({ message: "Logged out" });
    });
  });

  app.post("/api/auth/mark-demo-seen", requireAuth, async (req: Request, res: Response) => {
    try {
      await markUserDemoSeen(req.session.userId!);
      return res.json({ ok: true });
    } catch (err) {
      console.error("Mark demo seen error:", err);
      return res.status(500).json({ error: "Something went wrong" });
    }
  });

  app.put("/api/auth/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const { name } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Name is required" });
      }
      const user = await updateUserName(req.session.userId!, name.trim());
      return res.json({ user: { id: user.id, email: user.email, name: user.name, subscriptionPlan: user.subscriptionPlan || 'free', voiceUsageCount: user.voiceUsageCount || 0, adsRemoved: user.adsRemoved || false, voiceCreditsPurchased: user.voiceCreditsPurchased || 0, hasSeenDemo: user.hasSeenDemo || false } });
    } catch (err) {
      console.error("Update profile error:", err);
      return res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.put("/api/auth/password", requireAuth, async (req: Request, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current password and new password are required" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters" });
      }
      const user = await getUserById(req.session.userId!);
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await updateUserPassword(req.session.userId!, hashedPassword);
      return res.json({ message: "Password updated successfully" });
    } catch (err) {
      console.error("Change password error:", err);
      return res.status(500).json({ error: "Failed to change password" });
    }
  });

  app.delete("/api/auth/account", requireAuth, async (req: Request, res: Response) => {
    try {
      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ error: "Password is required" });
      }
      const user = await getUserById(req.session.userId!);
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(400).json({ error: "Password is incorrect" });
      }
      await deleteUserAccount(req.session.userId!);
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

  // ─── Public Account Deletion Page ──────────────────────────────
  // Play Store policy (July 2024+): every app that lets users create an
  // account must expose a publicly reachable URL where they can request
  // account + data deletion without re-installing. This page is linked
  // from the Play listing and from the in-app privacy screen.
  const accountDeletionPage = (message: string, isError: boolean) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Delete your Hisaabit account</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #F7F8FB; color: #1A1A2E; }
    .wrap { max-width: 520px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #fff; border: 1px solid #E5E7EB; border-radius: 16px; padding: 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    h1 { margin: 0 0 8px 0; font-size: 24px; color: #1E3A5F; }
    .subtitle { margin: 0 0 20px 0; color: #6B7280; font-size: 14px; }
    ul { padding-left: 20px; color: #4B5563; font-size: 14px; line-height: 1.6; }
    label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin: 14px 0 6px; }
    input { width: 100%; padding: 12px 14px; border: 1px solid #D1D5DB; border-radius: 10px; font-size: 15px; font-family: inherit; }
    input:focus { outline: none; border-color: #1E3A5F; }
    button { width: 100%; margin-top: 20px; padding: 14px; background: #DC2626; color: #fff; border: 0; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; }
    button:hover { background: #B91C1C; }
    button:disabled { background: #9CA3AF; cursor: not-allowed; }
    .msg { padding: 12px 14px; border-radius: 10px; margin-bottom: 16px; font-size: 14px; }
    .err { background: #FEF2F2; color: #991B1B; border: 1px solid #FECACA; }
    .ok { background: #F0FDF4; color: #166534; border: 1px solid #BBF7D0; }
    .foot { text-align: center; margin-top: 20px; color: #9CA3AF; font-size: 12px; }
    a { color: #1E3A5F; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Delete your Hisaabit account</h1>
      <p class="subtitle">Confirm with your email and password. This is permanent.</p>
      ${message ? `<div class="msg ${isError ? "err" : "ok"}">${message}</div>` : ""}
      <p style="margin:0 0 6px 0;font-size:13px;color:#374151;font-weight:600;">This will permanently remove:</p>
      <ul>
        <li>Your account (name, email, password hash)</li>
        <li>Every expense you ever logged</li>
        <li>All budgets, monthly budgets, and settings</li>
        <li>Your active sessions on every device</li>
      </ul>
      <form method="POST" action="/account-deletion" autocomplete="off">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" required autocomplete="email" />
        <label for="password">Password</label>
        <input id="password" name="password" type="password" required autocomplete="current-password" />
        <button type="submit">Permanently delete my account</button>
      </form>
    </div>
    <p class="foot">Need help? Email <a href="mailto:support@hisaabit.com">support@hisaabit.com</a></p>
  </div>
</body>
</html>`;

  app.get("/account-deletion", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(accountDeletionPage("", false));
  });

  app.post("/account-deletion", authLimiter, async (req: Request, res: Response) => {
    try {
      const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
      const password = typeof req.body?.password === "string" ? req.body.password : "";

      if (!email || !password) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.status(400).send(accountDeletionPage("Email and password are both required.", true));
      }

      const user = await getUserByEmail(email);
      if (!user) {
        // Generic message — don't leak whether the email exists.
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.status(400).send(accountDeletionPage("Those credentials don't match an account.", true));
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.status(400).send(accountDeletionPage("Those credentials don't match an account.", true));
      }

      await deleteUserAccount(user.id);

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(accountDeletionPage(
        "Your account and all associated data have been permanently deleted. Thank you for using Hisaabit.",
        false,
      ));
    } catch (err) {
      console.error("Public account deletion error:", err);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(500).send(accountDeletionPage("Something went wrong. Please try again or email support.", true));
    }
  });

  // ─── Public Privacy Policy Page ────────────────────────────────
  // Play Store requires every listing to link to a public Privacy Policy
  // URL. This page is the source of truth — the in-app /privacy screen
  // mirrors the same disclosures. Keep them in sync when either changes.
  const privacyPolicyPage = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Privacy Policy – Hisaabit</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #F7F8FB; color: #1A1A2E; }
    .wrap { max-width: 720px; margin: 0 auto; padding: 40px 20px 60px; }
    .card { background: #fff; border: 1px solid #E5E7EB; border-radius: 16px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    h1 { margin: 0 0 4px 0; font-size: 28px; color: #1E3A5F; }
    .updated { color: #6B7280; font-size: 13px; margin: 0 0 24px 0; }
    h2 { font-size: 18px; color: #1E3A5F; margin: 28px 0 8px 0; }
    p, li { color: #374151; font-size: 15px; line-height: 1.65; }
    ul { padding-left: 22px; margin: 8px 0 12px 0; }
    li { margin-bottom: 4px; }
    a { color: #1E3A5F; }
    code { background: #F3F4F6; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
    .foot { text-align: center; margin-top: 24px; color: #9CA3AF; font-size: 12px; }
    .callout { background: #F0F9FF; border: 1px solid #BAE6FD; border-radius: 10px; padding: 12px 14px; margin: 12px 0; font-size: 14px; color: #0C4A6E; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Privacy Policy</h1>
      <p class="updated">Last updated: 24 April 2026</p>

      <p>
        Hisaabit is a personal-finance app made for tracking daily expenses in Pakistani Rupees.
        This policy explains what we collect, why we collect it, where it lives, and how you can
        remove it. It applies to the Hisaabit mobile app and the backend service that supports it.
      </p>

      <h2>Who we are</h2>
      <p>
        Hisaabit is operated independently. Questions or requests about your data:
        <a href="mailto:support@hisaabit.com">support@hisaabit.com</a>.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account info:</strong> your name, email address, and a bcrypt-hashed version of your password. We never see or store your raw password.</li>
        <li><strong>Expense data:</strong> amounts, categories, optional notes, and the date/time of each expense you log.</li>
        <li><strong>Budget settings:</strong> daily, weekly, and monthly budgets you set, plus category preferences.</li>
        <li><strong>Voice recordings (temporary):</strong> when you tap the microphone button, we upload that audio clip to our server for transcription. It is deleted immediately after the text is extracted.</li>
        <li><strong>Session cookie:</strong> a signed cookie that keeps you logged in across app restarts.</li>
      </ul>

      <h2>What we do NOT collect</h2>
      <ul>
        <li>Your location</li>
        <li>Your contacts</li>
        <li>Your SMS messages (SMS-import is fully on-device — nothing leaves your phone)</li>
        <li>Your photos, files, or camera access</li>
        <li>Any advertising or analytics identifiers</li>
      </ul>

      <h2>Why we collect it</h2>
      <p>
        Every piece of data we store exists because the app needs it to work for you:
      </p>
      <ul>
        <li>Account info lets you log in on more than one device.</li>
        <li>Expense and budget data powers the charts, summaries, and weekly report.</li>
        <li>Voice clips are transcribed into expenses and then discarded.</li>
      </ul>
      <p>We do not sell your data. We do not use it for advertising. We do not share it with third parties for marketing.</p>

      <h2>Where your data lives</h2>
      <ul>
        <li><strong>Database:</strong> PostgreSQL hosted on Railway. All traffic between the app and database travels over HTTPS/TLS.</li>
        <li><strong>Voice transcription:</strong> audio clips are sent to OpenAI (Whisper + GPT-4o-mini) for speech-to-text. OpenAI does not use API traffic to train their models. The clip is deleted on our server as soon as the transcript is returned.</li>
        <li><strong>Email delivery:</strong> account-confirmation and password-reset emails are sent via Resend. Only your email address is passed to Resend.</li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        Your account and all associated expenses, budgets, and settings remain stored until you
        delete your account. When you delete your account, the deletion is permanent and takes
        effect immediately — there is no soft-delete or recovery window.
      </p>

      <h2>Your rights &amp; controls</h2>
      <ul>
        <li><strong>Export:</strong> download a JSON copy of everything we hold about you from inside the app (Settings → Export data).</li>
        <li><strong>Delete in-app:</strong> Settings → Delete account (requires your password).</li>
        <li><strong>Delete from the web:</strong> if you no longer have the app installed, visit <a href="/account-deletion">/account-deletion</a> and confirm with your email and password.</li>
        <li><strong>Edit:</strong> you can change your name, password, and any expense or budget at any time from inside the app.</li>
      </ul>

      <div class="callout">
        You do not need to contact us to delete your account. Account deletion is fully
        self-service — either from inside the app or from the public deletion page above.
      </div>

      <h2>Security</h2>
      <ul>
        <li>Passwords are hashed with bcrypt (cost factor 10) before being stored.</li>
        <li>All network traffic between the app and our servers uses HTTPS.</li>
        <li>Authentication rate-limiting protects your account from brute-force attempts.</li>
        <li>Session cookies are HTTP-only and signed; they cannot be read by JavaScript.</li>
      </ul>
      <p>
        No online service can guarantee perfect security, but we treat your data with the same
        care we would want for our own.
      </p>

      <h2>Children</h2>
      <p>
        Hisaabit is not directed at children under 13 and we do not knowingly collect data from
        them. If you believe a child has created an account, email
        <a href="mailto:support@hisaabit.com">support@hisaabit.com</a> and we will remove it.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If we change anything material about what we collect or how we use it, we will update the
        "Last updated" date above and — where the change affects existing users — note it inside
        the app. Continuing to use Hisaabit after a change means you accept the updated policy.
      </p>

      <h2>Contact</h2>
      <p>
        Questions, concerns, or deletion requests:
        <a href="mailto:support@hisaabit.com">support@hisaabit.com</a>.
      </p>
    </div>
    <p class="foot">Hisaabit · Personal Finance Tracker for Pakistan</p>
  </div>
</body>
</html>`;

  app.get("/privacy", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(privacyPolicyPage);
  });

  app.get("/api/auth/export", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await getUserById(req.session.userId!);
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const userExpenses = await getExpensesByUser(req.session.userId!);
      const userBudgets = await getBudgetsByUser(req.session.userId!);
      const userMonthlyBudgets = await getMonthlyBudgetsByUser(req.session.userId!);
      return res.json({
        user: { name: user.name, email: user.email },
        expenses: userExpenses,
        budgets: userBudgets,
        monthlyBudgets: userMonthlyBudgets,
      });
    } catch (err) {
      console.error("Export data error:", err);
      return res.status(500).json({ error: "Failed to export data" });
    }
  });

  app.get("/api/expenses", requireAuth, async (req: Request, res: Response) => {
    try {
      const expenses = await getExpensesByUser(req.session.userId!);
      return res.json(expenses);
    } catch (err) {
      console.error("Get expenses error:", err);
      return res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  app.post("/api/expenses", requireAuth, async (req: Request, res: Response) => {
    try {
      const { amount, category, note, date } = req.body;
      if (!amount || !category || !date) {
        return res.status(400).json({ error: "Amount, category and date are required" });
      }
      if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0 || amount > 100_000_000) {
        return res.status(400).json({ error: "Amount must be a positive integer (max 100,000,000)" });
      }
      if (!VALID_CATEGORY_KEYS.includes(category)) {
        return res.status(400).json({ error: "Invalid category" });
      }
      const expense = await addExpense(req.session.userId!, { amount, category, note: note || "", date });
      return res.json(expense);
    } catch (err) {
      console.error("Add expense error:", err);
      return res.status(500).json({ error: "Failed to add expense" });
    }
  });

  app.put("/api/expenses/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { amount, category, note, date } = req.body;
      if (!amount || !category || !date) {
        return res.status(400).json({ error: "Amount, category and date are required" });
      }
      if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0 || amount > 100_000_000) {
        return res.status(400).json({ error: "Amount must be a positive integer (max 100,000,000)" });
      }
      if (!VALID_CATEGORY_KEYS.includes(category)) {
        return res.status(400).json({ error: "Invalid category" });
      }
      const updated = await updateExpenseById(req.session.userId!, req.params.id as string, {
        amount,
        category,
        note: note || "",
        date,
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

  app.delete("/api/expenses/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const deleted = await deleteExpenseById(req.session.userId!, req.params.id as string);
      if (!deleted) {
        return res.status(404).json({ error: "Expense not found" });
      }
      return res.json({ message: "Deleted" });
    } catch (err) {
      console.error("Delete expense error:", err);
      return res.status(500).json({ error: "Failed to delete expense" });
    }
  });

  app.get("/api/budgets", requireAuth, async (req: Request, res: Response) => {
    try {
      const budgets = await getBudgetsByUser(req.session.userId!);
      return res.json(budgets);
    } catch (err) {
      console.error("Get budgets error:", err);
      return res.status(500).json({ error: "Failed to fetch budgets" });
    }
  });

  app.post("/api/budgets", requireAuth, async (req: Request, res: Response) => {
    try {
      const { category, limit, month } = req.body;
      if (!category || !limit || !month) {
        return res.status(400).json({ error: "Category, limit and month are required" });
      }
      if (typeof limit !== "number" || !Number.isInteger(limit) || limit <= 0 || limit > 100_000_000) {
        return res.status(400).json({ error: "Limit must be a positive integer (max 100,000,000)" });
      }
      if (!VALID_CATEGORY_KEYS.includes(category)) {
        return res.status(400).json({ error: "Invalid category" });
      }
      const budget = await setBudgetForUser(req.session.userId!, { category, limit, month });
      return res.json(budget);
    } catch (err) {
      console.error("Set budget error:", err);
      return res.status(500).json({ error: "Failed to set budget" });
    }
  });

  app.delete("/api/budgets/:category/:month", requireAuth, async (req: Request, res: Response) => {
    try {
      const deleted = await deleteBudgetForUser(req.session.userId!, req.params.category as string, req.params.month as string);
      if (!deleted) {
        return res.status(404).json({ error: "Budget not found" });
      }
      return res.json({ message: "Deleted" });
    } catch (err) {
      console.error("Delete budget error:", err);
      return res.status(500).json({ error: "Failed to delete budget" });
    }
  });

  app.get("/api/monthly-budgets", requireAuth, async (req: Request, res: Response) => {
    try {
      const budgets = await getMonthlyBudgetsByUser(req.session.userId!);
      return res.json(budgets);
    } catch (err) {
      console.error("Get monthly budgets error:", err);
      return res.status(500).json({ error: "Failed to fetch monthly budgets" });
    }
  });

  app.get("/api/monthly-budgets/:month", requireAuth, async (req: Request, res: Response) => {
    try {
      const budget = await getMonthlyBudgetForUser(req.session.userId!, req.params.month as string);
      return res.json(budget);
    } catch (err) {
      console.error("Get monthly budget error:", err);
      return res.status(500).json({ error: "Failed to fetch monthly budget" });
    }
  });

  app.post("/api/monthly-budgets", requireAuth, async (req: Request, res: Response) => {
    try {
      const { month, totalLimit } = req.body;
      if (!month || !totalLimit) {
        return res.status(400).json({ error: "Month and totalLimit are required" });
      }
      if (typeof totalLimit !== "number" || !Number.isInteger(totalLimit) || totalLimit <= 0 || totalLimit > 100_000_000) {
        return res.status(400).json({ error: "Total limit must be a positive integer (max 100,000,000)" });
      }
      const budget = await setMonthlyBudgetForUser(req.session.userId!, { month, totalLimit });
      return res.json(budget);
    } catch (err) {
      console.error("Set monthly budget error:", err);
      return res.status(500).json({ error: "Failed to set monthly budget" });
    }
  });

  app.get("/api/budget-settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const settings = await getBudgetSettings(req.session.userId!);
      return res.json(settings);
    } catch (err) {
      console.error("Get budget settings error:", err);
      return res.status(500).json({ error: "Failed to fetch budget settings" });
    }
  });

  app.put("/api/budget-settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const { dailyLimit, weeklyLimit } = req.body;
      if (dailyLimit !== null && dailyLimit !== undefined && (typeof dailyLimit !== "number" || !Number.isInteger(dailyLimit) || dailyLimit <= 0 || dailyLimit > 100_000_000)) {
        return res.status(400).json({ error: "Daily limit must be a positive integer (max 100,000,000)" });
      }
      if (weeklyLimit !== null && weeklyLimit !== undefined && (typeof weeklyLimit !== "number" || !Number.isInteger(weeklyLimit) || weeklyLimit <= 0 || weeklyLimit > 100_000_000)) {
        return res.status(400).json({ error: "Weekly limit must be a positive integer (max 100,000,000)" });
      }
      const settings = await setBudgetSettings(req.session.userId!, { dailyLimit, weeklyLimit });
      return res.json(settings);
    } catch (err) {
      console.error("Set budget settings error:", err);
      return res.status(500).json({ error: "Failed to save budget settings" });
    }
  });

  app.get("/api/subscription", requireAuth, async (req: Request, res: Response) => {
    try {
      const info = await getSubscriptionInfo(req.session.userId!);
      if (!info) {
        return res.status(404).json({ error: "User not found" });
      }
      const currentMonth = new Date().toISOString().slice(0, 7);
      const voiceUsageCount = info.voiceUsageResetMonth === currentMonth ? info.voiceUsageCount : 0;
      return res.json({
        adsRemoved: info.adsRemoved,
        voiceUsageCount,
        voiceCreditsPurchased: info.voiceCreditsPurchased,
        monthlyFreeLimit: 5,
      });
    } catch (err) {
      console.error("Get subscription error:", err);
      return res.status(500).json({ error: "Failed to get subscription info" });
    }
  });

  app.post("/api/purchase", requireAuth, async (req: Request, res: Response) => {
    try {
      const { action } = req.body;
      if (action === "remove_ads") {
        await purchaseAdRemoval(req.session.userId!);
        return res.json({ success: true, message: "Ads removed successfully" });
      } else if (action === "buy_voice_credits") {
        const newBalance = await purchaseVoiceCredits(req.session.userId!, 50);
        return res.json({ success: true, message: "50 voice credits added", voiceCreditsPurchased: newBalance });
      } else {
        return res.status(400).json({ error: "Invalid action. Use 'remove_ads' or 'buy_voice_credits'" });
      }
    } catch (err) {
      console.error("Purchase error:", err);
      return res.status(500).json({ error: "Purchase failed. Please try again." });
    }
  });

  app.post("/api/voice-expense", voiceLimiter, upload.single("audio"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
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
        prompt: "This is a Pakistani household expense spoken in Urdu or Roman Urdu or English. It may contain amounts in Pakistani Rupees (PKR). Common words: rupay, hazaar, sau, kiryana, sabzi, bijli, gas, school, petrol, chai, nashta, kapray, dawai, rent, kiraya.",
      });

      try { fs.unlinkSync(renamedPath); } catch {};

      const transcript = transcription.text;

      if (!transcript || transcript.trim().length === 0) {
        return res.status(400).json({ error: "Could not understand the audio. Please try again." });
      }

      const categoryList = CATEGORIES.map(c => `"${c.key}" (${c.label})`).join(", ");

      // Use the client's local-timezone date for "today" so phrases like
      // "aaj" / "today" resolve against the user's wall-clock day, not the
      // server's UTC day. Fall back to UTC only when the client didn't
      // provide one (old builds, curl, etc).
      const rawLocalDate = typeof req.body?.localDate === "string" ? req.body.localDate : "";
      const todayLocal = /^\d{4}-\d{2}-\d{2}$/.test(rawLocalDate)
        ? rawLocalDate
        : new Date().toISOString().split("T")[0];
      const yesterdayLocal = (() => {
        const d = new Date(todayLocal + "T12:00:00Z");
        d.setUTCDate(d.getUTCDate() - 1);
        return d.toISOString().split("T")[0];
      })();

      const extraction = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `You extract expense details from Pakistani household expense descriptions. The user speaks in Urdu, Roman Urdu, or English. A single message may mention MULTIPLE separate expenses — you must extract ALL of them. Today's date is ${todayLocal}.

For EACH expense, extract:
1. amount: The amount in PKR (Pakistani Rupees). Convert words like "hazaar" (thousand), "sau" (hundred), "lakh" to numbers. "paanch sau" = 500, "do hazaar" = 2000, "teen sau pachaas" = 350.
2. category: One of these exact keys: ${categoryList}. Match based on context.
3. note: A brief description of the expense in English.
4. date: The date the expense was made as an ISO date string (YYYY-MM-DD). Interpret relative dates like "kal" / "yesterday", "parso" / "day before yesterday", "aaj" / "today", "pichle hafte" / "last week", "Monday", etc. relative to today. If no date is mentioned, use today's date.

ALWAYS respond with a JSON array, even for a single expense:
[{"amount": number, "category": "key", "note": "description", "date": "YYYY-MM-DD"}]

Examples:
- "kiryana ka saman liya paanch sau ka aur bijli ka bill do hazaar tha" → [{"amount":500,"category":"kiryana","note":"Grocery shopping","date":"${todayLocal}"},{"amount":2000,"category":"bijliBill","note":"Electricity bill","date":"${todayLocal}"}]
- "kal chai pi teen sau ki" → [{"amount":300,"category":"chaiNashta","note":"Tea","date":"${yesterdayLocal}"}]

If you cannot determine the amount for an expense, use 0. If you cannot determine the category, use "general". If no date is mentioned, use today's date.`,
          },
          {
            role: "user",
            content: transcript,
          },
        ],
      });

      const content = extraction.choices[0]?.message?.content || "";

      let expenses: { amount: number; category: string; note: string; date?: string }[];
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          expenses = JSON.parse(jsonMatch[0]);
        } else {
          const objMatch = content.match(/\{[\s\S]*\}/);
          if (!objMatch) throw new Error("No JSON found");
          expenses = [JSON.parse(objMatch[0])];
        }
        if (!Array.isArray(expenses)) {
          expenses = [expenses];
        }
      } catch {
        expenses = [{ amount: 0, category: "general", note: transcript }];
      }

      const todayStr = todayLocal;
      const validatedExpenses = expenses.map(e => {
        const validCategory = CATEGORIES.find(c => c.key === e.category);
        let dateStr = todayStr;
        if (e.date && /^\d{4}-\d{2}-\d{2}$/.test(e.date)) {
          dateStr = e.date;
        }
        return {
          amount: Math.max(0, Math.round(e.amount || 0)),
          category: validCategory ? e.category : "general",
          note: e.note || "",
          date: dateStr,
        };
      });

      const finalExpenses = validatedExpenses;

      return res.json({
        transcript,
        expenses: finalExpenses,
      });
    } catch (err: any) {
      console.error("Voice expense error:", err);
      // Surface the underlying error class + message to the client so we can
      // diagnose issues on device without needing Railway logs. We avoid
      // leaking stack traces or full OpenAI response bodies — just enough
      // signal: "OpenAI: 401 Invalid API key", "ENOENT rename …", etc.
      const name = err?.name || "Error";
      const message = typeof err?.message === "string" ? err.message : String(err);
      const openaiStatus = err?.status ? ` [openai-status:${err.status}]` : "";
      const code = err?.code ? ` [${err.code}]` : "";
      return res.status(500).json({
        error: `Failed to process voice note: ${name}${code}${openaiStatus}: ${message.slice(0, 200)}`,
      });
    }
  });

  // ─── SMS Expense Endpoints ──────────────────────────────────────

  app.post("/api/sms/process", smsLimiter, requireAuth, async (req: Request, res: Response) => {
    try {
      const { messages } = req.body;
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "No messages provided" });
      }

      // Cap at 50 messages per request
      const capped = messages.slice(0, 50);

      // Compute hashes and deduplicate against already-processed
      const hashMap = capped.map((m: { sender: string; body: string; timestamp: number }) => ({
        ...m,
        hash: createHash("sha256").update(`${m.sender}|${m.body}|${m.timestamp}`).digest("hex"),
      }));

      const alreadyProcessed = await bulkCheckProcessedSms(req.session.userId!, hashMap.map(h => h.hash));
      const newMessages = hashMap.filter(h => !alreadyProcessed.has(h.hash));

      if (newMessages.length === 0) {
        return res.json({ processed: 0, pending: 0, skipped: capped.length });
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "OpenAI API key not configured" });
      }

      const openai = new OpenAI({ apiKey });
      const todayStr = new Date().toISOString().split("T")[0];
      const categoryList = CATEGORIES.map(c => `"${c.key}" (${c.label})`).join(", ");

      const smsArray = newMessages.map((m, i) => ({
        index: i,
        sender: m.sender,
        body: m.body,
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
- smsIndex corresponds to the "index" field in the input array`,
          },
          {
            role: "user",
            content: JSON.stringify(smsArray),
          },
        ],
      });

      const content = extraction.choices[0]?.message?.content || "[]";
      let parsed: { amount: number; category: string; note: string; date: string; type: string; smsIndex: number }[];
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        if (!Array.isArray(parsed)) parsed = [];
      } catch {
        parsed = [];
      }

      // Validate and build pending expenses
      const pendingItems = parsed
        .filter(e => e.type === "debit" && e.amount > 0 && e.smsIndex >= 0 && e.smsIndex < newMessages.length)
        .map(e => {
          const validCategory = VALID_CATEGORY_KEYS.includes(e.category) ? e.category : "general";
          const dateStr = e.date && /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : todayStr;
          const sourceMsg = newMessages[e.smsIndex];
          return {
            amount: Math.round(e.amount),
            category: validCategory,
            note: e.note || "",
            date: dateStr,
            smsSender: sourceMsg?.sender || undefined,
            smsBody: sourceMsg?.body || undefined,
          };
        });

      // Save pending expenses
      const created = await bulkAddPendingExpenses(req.session.userId!, pendingItems);

      // Mark all submitted SMS as processed
      await markSmsBulkProcessed(
        req.session.userId!,
        newMessages.map(m => ({
          hash: m.hash,
          timestamp: m.timestamp ? new Date(m.timestamp) : undefined,
        }))
      );

      // Update last read timestamp
      await updateLastSmsReadTimestamp(req.session.userId!, new Date());

      return res.json({
        processed: newMessages.length,
        pending: created.length,
        skipped: capped.length - newMessages.length,
      });
    } catch (err: any) {
      console.error("SMS process error:", err);
      return res.status(500).json({ error: "Failed to process SMS messages" });
    }
  });

  app.get("/api/sms/pending", requireAuth, async (req: Request, res: Response) => {
    try {
      const pending = await getPendingExpensesByUser(req.session.userId!);
      return res.json(pending);
    } catch (err) {
      console.error("Get pending SMS error:", err);
      return res.status(500).json({ error: "Failed to get pending expenses" });
    }
  });

  app.get("/api/sms/pending/count", requireAuth, async (req: Request, res: Response) => {
    try {
      const count = await getPendingExpenseCount(req.session.userId!);
      return res.json({ count });
    } catch (err) {
      console.error("Get pending count error:", err);
      return res.status(500).json({ error: "Failed to get pending count" });
    }
  });

  app.put("/api/sms/pending/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { amount, category, note, date } = req.body;
      if (category && !VALID_CATEGORY_KEYS.includes(category)) {
        return res.status(400).json({ error: "Invalid category" });
      }
      if (amount !== undefined && (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0 || amount > 100_000_000)) {
        return res.status(400).json({ error: "Amount must be a positive integer (max 100,000,000)" });
      }
      const updated = await updatePendingExpense(req.session.userId!, req.params.id as string, { amount, category, note, date });
      if (!updated) return res.status(404).json({ error: "Pending expense not found" });
      return res.json(updated);
    } catch (err) {
      console.error("Update pending error:", err);
      return res.status(500).json({ error: "Failed to update pending expense" });
    }
  });

  app.post("/api/sms/pending/:id/confirm", requireAuth, async (req: Request, res: Response) => {
    try {
      const expense = await confirmPendingExpense(req.session.userId!, req.params.id as string);
      if (!expense) return res.status(404).json({ error: "Pending expense not found" });
      return res.json(expense);
    } catch (err) {
      console.error("Confirm pending error:", err);
      return res.status(500).json({ error: "Failed to confirm expense" });
    }
  });

  app.post("/api/sms/pending/:id/dismiss", requireAuth, async (req: Request, res: Response) => {
    try {
      const dismissed = await dismissPendingExpense(req.session.userId!, req.params.id as string);
      if (!dismissed) return res.status(404).json({ error: "Pending expense not found" });
      return res.json({ message: "Dismissed" });
    } catch (err) {
      console.error("Dismiss pending error:", err);
      return res.status(500).json({ error: "Failed to dismiss expense" });
    }
  });

  app.post("/api/sms/pending/confirm-all", requireAuth, async (req: Request, res: Response) => {
    try {
      const created = await confirmAllPending(req.session.userId!);
      return res.json({ confirmed: created.length, expenses: created });
    } catch (err) {
      console.error("Confirm all error:", err);
      return res.status(500).json({ error: "Failed to confirm all expenses" });
    }
  });

  app.post("/api/sms/pending/dismiss-all", requireAuth, async (req: Request, res: Response) => {
    try {
      const count = await dismissAllPending(req.session.userId!);
      return res.json({ dismissed: count });
    } catch (err) {
      console.error("Dismiss all error:", err);
      return res.status(500).json({ error: "Failed to dismiss all expenses" });
    }
  });

  app.get("/api/sms/settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const settings = await getSmsSettings(req.session.userId!);
      return res.json({
        smsParsingEnabled: settings.smsParsingEnabled,
        lastSmsReadTimestamp: settings.lastSmsReadTimestamp?.toISOString() || null,
      });
    } catch (err) {
      console.error("Get SMS settings error:", err);
      return res.status(500).json({ error: "Failed to get SMS settings" });
    }
  });

  app.put("/api/sms/settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const { smsParsingEnabled } = req.body;
      if (typeof smsParsingEnabled !== "boolean") {
        return res.status(400).json({ error: "smsParsingEnabled must be a boolean" });
      }
      await updateSmsParsingEnabled(req.session.userId!, smsParsingEnabled);
      return res.json({ smsParsingEnabled });
    } catch (err) {
      console.error("Update SMS settings error:", err);
      return res.status(500).json({ error: "Failed to update SMS settings" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

function confirmationPage(success: boolean, message: string): string {
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
