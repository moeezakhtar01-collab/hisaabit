import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import multer from "multer";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";

const upload = multer({ dest: "/tmp/uploads/" });

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
