import * as Crypto from 'expo-crypto';

/**
 * On-device notification parsing (the "regex" half of the hybrid pipeline).
 *
 * Goal: cheaply + privately handle the common, well-shaped bank/wallet
 * transaction notifications WITHOUT a network/AI call. Anything we can't parse
 * confidently returns null and the caller falls back to server AI.
 *
 * Accuracy matters more than coverage here: a wrong auto-saved expense can't be
 * corrected (no manual edit in v2), so parseOnDevice is deliberately
 * conservative — it only returns a result when the amount + debit intent are
 * unambiguous, otherwise it defers to AI.
 */

export interface NotificationInput {
  app: string;   // sender package name
  title: string;
  text: string;
  time: number;  // ms epoch (sender-reported); 0 if absent
}

export interface ParsedExpense {
  amount: number;     // PKR integer
  category: string;   // one of the 11 category keys
  note: string;
  date: string;       // YYYY-MM-DD (local)
}

// Known Pakistani bank/wallet package names → display label. These are
// best-guess and get corrected from real device captures (the debug screen
// shows the true package names). NOTE: parsing does NOT depend on this list —
// looksFinancial() also works heuristically — so a wrong/missing entry only
// affects the friendly label, never whether a notification is processed.
const FINANCIAL_PACKAGES: Record<string, string> = {
  'com.techlogix.mobilinkcustomer': 'JazzCash',
  'pk.com.telenor.phoenix': 'Easypaisa',
  'com.sadapay.android': 'SadaPay',
  'com.nayapay.app': 'NayaPay',
  'com.hbl.mobile': 'HBL',
  'com.ubl.android': 'UBL Digital',
  'com.meezanbank.mb': 'Meezan',
  'com.mcb.android': 'MCB',
  'com.alfa.bankalfalah': 'Alfa',
  'com.alliedbank.myabl': 'Allied',
  'com.fbl.digibank': 'Faysal',
};

// Words that signal a money-movement-out (an expense). Credit/incoming words
// are handled separately so we can skip them.
const DEBIT_WORDS = [
  'debit', 'debited', 'sent', 'paid', 'payment', 'purchase', 'spent',
  'withdrawn', 'withdrawal', 'transfer', 'transferred', 'deducted', 'charged',
];
const CREDIT_WORDS = ['credit', 'credited', 'received', 'refund', 'deposit', 'cashback', 'added to'];

// Generic financial vocabulary used by looksFinancial() to gate AI calls so we
// never send a WhatsApp/news notification to the server.
const FINANCIAL_WORDS = [
  ...DEBIT_WORDS, ...CREDIT_WORDS,
  'transaction', 'txn', 'account', 'a/c', 'avbl', 'available balance', 'balance',
  'rs', 'rs.', 'pkr', 'rupees',
];

// Amount like "Rs. 2,500", "PKR 1500.00", "Rs1,234". Captures the number.
const AMOUNT_RE = /(?:rs\.?|pkr|rupees)\s*[:.]?\s*([\d,]+(?:\.\d{1,2})?)/i;

// Merchant keyword → category. First match wins; default 'general'.
const CATEGORY_KEYWORDS: [RegExp, string][] = [
  [/imtiaz|metro|al-?fatah|chase ?up|carrefour|grocer|mart|store|kiryana|sabzi/i, 'kiryana'],
  [/pso|shell|total|attock|byco|caltex|petrol|fuel|cng|uber|careem|indrive|bykea/i, 'transport'],
  [/kfc|mcdonald|hardees|pizza|dominos|foodpanda|cheezious|restaurant|cafe|coffee|bakery|tuck|dhaba|khana/i, 'chaiNashta'],
  [/khaadi|gul ?ahmed|sapphire|alkaram|outfitters|breakout|junaid|bonanza|clothing|garment|shoe|fashion/i, 'kapray'],
  [/fazal ?din|d\.?watson|servaid|pharmacy|clinic|hospital|medical|dawakhana|lab|diagnostic/i, 'medical'],
  [/wapda|k-?electric|lesco|fesco|iesco|mepco|electric|bijli/i, 'bijliBill'],
  [/sui|sngpl|ssgc|gas bill/i, 'gasBill'],
  [/water|wasa|pani/i, 'paniBill'],
  [/school|college|university|academy|tuition|fee|lums|nust|fast/i, 'schoolFees'],
  [/rent|kiraya/i, 'rent'],
];

export function senderLabel(pkg: string): string | null {
  return FINANCIAL_PACKAGES[pkg] ?? null;
}

function hay(n: NotificationInput): string {
  return `${n.title} ${n.text}`.toLowerCase();
}

/** Cheap gate before spending an AI call: is this plausibly a transaction? */
export function looksFinancial(n: NotificationInput): boolean {
  if (FINANCIAL_PACKAGES[n.app]) return true;
  const h = hay(n);
  const hasAmount = AMOUNT_RE.test(h);
  const hasWord = FINANCIAL_WORDS.some((w) => h.includes(w));
  return hasAmount && hasWord;
}

function parseAmount(h: string): number | null {
  const m = h.match(AMOUNT_RE);
  if (!m) return null;
  const n = Math.round(parseFloat(m[1].replace(/,/g, '')));
  return Number.isFinite(n) && n > 0 && n <= 100_000_000 ? n : null;
}

function categorize(h: string): string {
  for (const [re, cat] of CATEGORY_KEYWORDS) if (re.test(h)) return cat;
  return 'general';
}

/**
 * Conservative on-device parse. Returns a ParsedExpense ONLY for clear debits
 * with an unambiguous amount; otherwise null (→ AI fallback). `localDate` is
 * the caller's wall-clock day (notifications are real-time, so that's the date).
 */
export function parseOnDevice(n: NotificationInput, localDate: string): ParsedExpense | null {
  const h = hay(n);

  const isCredit = CREDIT_WORDS.some((w) => h.includes(w));
  const isDebit = DEBIT_WORDS.some((w) => h.includes(w));
  // Skip incoming money, and bail when intent is ambiguous (no debit word, or
  // both present) — let AI judge those.
  if (isCredit && !isDebit) return null;
  if (!isDebit) return null;

  const amount = parseAmount(h);
  if (amount === null) return null;

  const label = senderLabel(n.app);
  const note = (n.title || '').trim() || (label ? `${label} transaction` : 'Card/wallet payment');

  return { amount, category: categorize(h), note: note.slice(0, 100), date: localDate };
}

/**
 * Stable per-notification fingerprint for dedupe. Computed from the raw content
 * + day so re-reading the same notification (or the headless task firing twice)
 * never double-saves. Sent to the server as expenses.source_hash.
 */
export async function dedupeHash(n: NotificationInput, dayKey: string): Promise<string> {
  const norm = `${n.app}|${(n.title || '').trim()}|${(n.text || '').trim()}|${dayKey}`
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, norm);
}
