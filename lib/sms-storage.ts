import { apiRequest } from '@/lib/query-client';
import type { Expense } from '@/lib/storage';

export interface PendingExpense {
  id: string;
  amount: number;
  category: string;
  note: string;
  date: string;
  smsSender: string | null;
  smsBody: string | null;
  status: string;
  createdAt: string;
}

export interface SmsSettings {
  smsParsingEnabled: boolean;
  lastSmsReadTimestamp: string | null;
}

export interface SmsProcessResult {
  processed: number;
  pending: number;
  skipped: number;
}

export async function processSmsMessages(
  messages: { sender: string; body: string; timestamp: number }[]
): Promise<SmsProcessResult> {
  const res = await apiRequest('POST', '/api/sms/process', { messages });
  return await res.json();
}

export async function getPendingSmsExpenses(): Promise<PendingExpense[]> {
  try {
    const res = await apiRequest('GET', '/api/sms/pending');
    return await res.json();
  } catch {
    return [];
  }
}

export async function getPendingCount(): Promise<number> {
  try {
    const res = await apiRequest('GET', '/api/sms/pending/count');
    const data = await res.json();
    return data.count ?? 0;
  } catch {
    return 0;
  }
}

export async function updatePendingExpense(
  id: string,
  data: { amount?: number; category?: string; note?: string; date?: string }
): Promise<PendingExpense> {
  const res = await apiRequest('PUT', `/api/sms/pending/${id}`, data);
  return await res.json();
}

export async function confirmPendingExpense(id: string): Promise<Expense> {
  const res = await apiRequest('POST', `/api/sms/pending/${id}/confirm`);
  return await res.json();
}

export async function dismissPendingExpense(id: string): Promise<void> {
  await apiRequest('POST', `/api/sms/pending/${id}/dismiss`);
}

export async function confirmAllPending(): Promise<{ confirmed: number; expenses: Expense[] }> {
  const res = await apiRequest('POST', '/api/sms/pending/confirm-all');
  return await res.json();
}

export async function dismissAllPending(): Promise<{ dismissed: number }> {
  const res = await apiRequest('POST', '/api/sms/pending/dismiss-all');
  return await res.json();
}

export async function getSmsSettings(): Promise<SmsSettings> {
  try {
    const res = await apiRequest('GET', '/api/sms/settings');
    return await res.json();
  } catch {
    return { smsParsingEnabled: false, lastSmsReadTimestamp: null };
  }
}

export async function updateSmsSettings(enabled: boolean): Promise<SmsSettings> {
  const res = await apiRequest('PUT', '/api/sms/settings', { smsParsingEnabled: enabled });
  return await res.json();
}
