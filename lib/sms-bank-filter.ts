import { Platform } from 'react-native';

export interface RawSmsMessage {
  id: string;
  sender: string;
  body: string;
  timestamp: number;
}

// Pakistani bank and digital wallet sender IDs
const BANK_SENDERS = new Set([
  // Major banks
  'HBL', 'HBLAlerts', 'HBLBank',
  'UBL', 'UBLDigital', 'UBLBank',
  'MeezanBk', 'MEEZAN', 'Meezan', 'MeezanBank',
  'Alfalah', 'BAFL', 'BankAlfalah',
  'MCB', 'MCBBank', 'MCBAlerts',
  'SCB', 'StanChart',
  'ABL', 'AlliedBank', 'AlliedBk',
  'NBP', 'NatBank',
  'FaysalBk', 'Faysal', 'FaysalBank',
  'AskariBank', 'Askari', 'AskariBk',
  'SilkBank', 'BankIslami', 'BkIslami',
  'SummitBank', 'JSBank', 'JS-Bank',
  'HabibMetro', 'HMB',
  'Soneri', 'SoneriBk',
  // Digital wallets
  'JazzCash', 'Jazzcash', 'JAZZCASH',
  'Easypaisa', 'EasyPaisa', 'EASYPAISA',
  'NayaPay', 'SadaPay', 'Sadapay', 'SADAPAY',
  'RAAST',
  // Microfinance / other
  'UPaisa', 'SimSim',
]);

// Normalized set for case-insensitive matching
const BANK_SENDERS_LOWER = new Set(Array.from(BANK_SENDERS).map(s => s.toLowerCase()));

const TRANSACTION_PATTERNS = [
  /(?:Rs\.?|PKR|amount)\s*[\d,]+/i,
  /(?:debited|credited|deducted|received|paid|spent|purchase|withdrawn|transferred|sent to|debit)/i,
  /(?:txn|transaction|trx|payment|POS|ATM|transfer|a\/c|account|acct)/i,
  /(?:bal|balance|avail|available)\s*(?:Rs\.?|PKR)?\s*[\d,]+/i,
];

const EXCLUSION_PATTERNS = [
  /OTP|one.?time|verification|password|PIN|code is/i,
  /offer|discount|win|congratulations|prize|cashback|reward/i,
  /apply now|download|install|upgrade|activate/i,
  /dear customer.*welcome|thank you for choosing/i,
];

function isSenderBank(sender: string): boolean {
  const cleaned = sender.replace(/[^a-zA-Z]/g, '');
  return BANK_SENDERS_LOWER.has(cleaned.toLowerCase());
}

function isTransactionSms(body: string): boolean {
  // Must match at least 2 transaction patterns
  let matches = 0;
  for (const pattern of TRANSACTION_PATTERNS) {
    if (pattern.test(body)) matches++;
  }
  return matches >= 2;
}

function isExcluded(body: string): boolean {
  return EXCLUSION_PATTERNS.some(pattern => pattern.test(body));
}

export function isBankTransactionSms(sender: string, body: string): boolean {
  return isSenderBank(sender) && isTransactionSms(body) && !isExcluded(body);
}

export function filterBankTransactions(messages: RawSmsMessage[]): RawSmsMessage[] {
  if (Platform.OS !== 'android') return [];
  return messages.filter(m => isBankTransactionSms(m.sender, m.body));
}
