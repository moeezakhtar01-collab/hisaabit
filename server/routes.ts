import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import multer from "multer";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import bcrypt from "bcrypt";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { createClient } from "@supabase/supabase-js";
import {
  createUser,
  getUserByEmail,
  getUserById,
  setResetToken,
  resetPassword,
  confirmUserEmail,
  getExpensesByUser,
  addExpense,
  deleteExpenseById,
  getBudgetsByUser,
  setBudgetForUser,
  deleteBudgetForUser,
  getMonthlyBudgetsByUser,
  getMonthlyBudgetForUser,
  setMonthlyBudgetForUser,
  deleteMonthlyBudgetForUser,
} from "./storage";
import { randomBytes } from "crypto";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

const upload = multer({ dest: "/tmp/uploads/" });

function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase: ReturnType<typeof createClient> | null = null;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

async function sendConfirmationEmail(email: string, token: string) {
  if (!supabase) {
    console.warn("Supabase not configured, skipping confirmation email");
    return;
  }

  const appUrl = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.REPLIT_DEPLOYMENT_URL
      ? `https://${process.env.REPLIT_DEPLOYMENT_URL}`
      : "http://localhost:5000";

  const confirmUrl = `${appUrl}/api/auth/confirm-email?token=${token}`;

  const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: confirmUrl,
  });

  if (error) {
    console.error("Supabase email invite error:", error);
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password: randomBytes(32).toString("hex"),
      options: {
        emailRedirectTo: confirmUrl,
      },
    });
    if (signUpError) {
      console.error("Supabase signUp fallback error:", signUpError);
    }
  }
}

const CATEGORIES = [
  { key: "kiryana", label: "Kiryana", aliases: ["grocery", "groceries", "kiryana", "ration", "general store", "dukan"] },
  { key: "sabziMandi", label: "Sabzi Mandi", aliases: ["sabzi", "vegetables", "fruit", "mandi", "sabzi mandi", "phal"] },
  { key: "bijliBill", label: "Bijli Bill", aliases: ["bijli", "electricity", "light bill", "wapda", "electric"] },
  { key: "gasBill", label: "Gas Bill", aliases: ["gas", "sui gas", "gas bill", "sui northern", "sui southern"] },
  { key: "paniBill", label: "Pani Bill", aliases: ["pani", "water", "water bill"] },
  { key: "schoolFees", label: "School Fees", aliases: ["school", "fees", "tuition", "academy", "school fees", "coaching", "tution"] },
  { key: "transport", label: "Transport", aliases: ["transport", "petrol", "diesel", "rickshaw", "uber", "careem", "bus", "fuel", "cng"] },
  { key: "mobileRecharge", label: "Mobile Recharge", aliases: ["mobile", "recharge", "phone", "jazz", "telenor", "zong", "ufone", "internet", "wifi"] },
  { key: "medical", label: "Medical", aliases: ["medical", "doctor", "hospital", "medicine", "dawai", "pharmacy", "clinic", "lab test"] },
  { key: "chaiNashta", label: "Chai / Nashta", aliases: ["chai", "tea", "nashta", "breakfast", "restaurant", "hotel", "dhaba", "khana", "lunch", "dinner", "food", "biryani", "pizza"] },
  { key: "kapray", label: "Kapray", aliases: ["kapray", "clothes", "kapra", "shoes", "joota", "shopping", "dress"] },
  { key: "rent", label: "Rent", aliases: ["rent", "kiraya", "house rent", "ghar ka kiraya"] },
  { key: "general", label: "General", aliases: ["general", "other", "misc"] },
];

export async function registerRoutes(app: Express): Promise<Server> {
  const PgSession = connectPgSimple(session);
  app.use(
    session({
      store: new PgSession({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "hisaab-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: "lax",
      },
    })
  );

  app.post("/api/auth/register", async (req: Request, res: Response) => {
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

      try {
        await sendConfirmationEmail(email.toLowerCase().trim(), confirmationToken);
      } catch (err) {
        console.error("Failed to send confirmation email:", err);
      }

      return res.json({
        message: "Account created! Please check your email to confirm your account before logging in.",
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

  app.post("/api/auth/login", async (req: Request, res: Response) => {
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
      return res.json({ user: { id: user.id, email: user.email, name: user.name } });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  app.post("/api/auth/resend-confirmation", async (req: Request, res: Response) => {
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
      const { db } = await import("./db");
      const { users } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(users).set({ confirmationToken: newToken }).where(eq(users.id, user.id));

      try {
        await sendConfirmationEmail(email.toLowerCase().trim(), newToken);
      } catch (err) {
        console.error("Failed to resend confirmation email:", err);
      }

      return res.json({ message: "If an account exists, we've resent the confirmation email." });
    } catch (err) {
      console.error("Resend confirmation error:", err);
      return res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
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

  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
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

      return res.json({ user: { id: user.id, email: user.email, name: user.name } });
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
      const expense = await addExpense(req.session.userId!, { amount, category, note: note || "", date });
      return res.json(expense);
    } catch (err) {
      console.error("Add expense error:", err);
      return res.status(500).json({ error: "Failed to add expense" });
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
      const budget = await setMonthlyBudgetForUser(req.session.userId!, { month, totalLimit });
      return res.json(budget);
    } catch (err) {
      console.error("Set monthly budget error:", err);
      return res.status(500).json({ error: "Failed to set monthly budget" });
    }
  });

  app.post("/api/voice-expense", upload.single("audio"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
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

      const extraction = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `You extract expense details from Pakistani household expense descriptions. The user speaks in Urdu, Roman Urdu, or English. A single message may mention MULTIPLE separate expenses — you must extract ALL of them.

For EACH expense, extract:
1. amount: The amount in PKR (Pakistani Rupees). Convert words like "hazaar" (thousand), "sau" (hundred), "lakh" to numbers. "paanch sau" = 500, "do hazaar" = 2000, "teen sau pachaas" = 350.
2. category: One of these exact keys: ${categoryList}. Match based on context.
3. note: A brief description of the expense in English.

ALWAYS respond with a JSON array, even for a single expense:
[{"amount": number, "category": "key", "note": "description"}]

Examples:
- "kiryana ka saman liya paanch sau ka aur bijli ka bill do hazaar tha" → [{"amount":500,"category":"kiryana","note":"Grocery shopping"},{"amount":2000,"category":"bijliBill","note":"Electricity bill"}]
- "aaj chai pi teen sau ki" → [{"amount":300,"category":"chaiNashta","note":"Tea"}]

If you cannot determine the amount for an expense, use 0. If you cannot determine the category, use "general".`,
          },
          {
            role: "user",
            content: transcript,
          },
        ],
      });

      const content = extraction.choices[0]?.message?.content || "";

      let expenses: { amount: number; category: string; note: string }[];
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

      const validatedExpenses = expenses.map(e => {
        const validCategory = CATEGORIES.find(c => c.key === e.category);
        return {
          amount: Math.max(0, Math.round(e.amount || 0)),
          category: validCategory ? e.category : "general",
          note: e.note || "",
        };
      });

      return res.json({
        transcript,
        expenses: validatedExpenses,
      });
    } catch (err: any) {
      console.error("Voice expense error:", err);
      return res.status(500).json({ error: "Failed to process voice note. Please try again." });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

function confirmationPage(success: boolean, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Confirmation - Hisaab</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #F8F9FA; color: #1A1A2E; }
    .container { text-align: center; padding: 40px; max-width: 400px; background: white; border-radius: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .icon { width: 72px; height: 72px; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 32px; }
    .success { background: #0D6B3F15; }
    .error { background: #EF444415; }
    h1 { font-size: 22px; margin: 0 0 12px; }
    p { font-size: 15px; color: #6B7280; line-height: 1.6; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon ${success ? "success" : "error"}">${success ? "✓" : "✕"}</div>
    <h1>${success ? "Email Confirmed!" : "Confirmation Failed"}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
