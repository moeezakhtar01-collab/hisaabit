import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '@/lib/query-client';
import { getOrCreateDeviceId } from '@/lib/device-id';
import { looksFinancial, parseOnDevice, dedupeHash, type NotificationInput } from '@/lib/notification-parser';

/**
 * Headless task handler for incoming notifications (Android only).
 *
 * Registered in index.js via AppRegistry.registerHeadlessTask. Android runs it
 * for EVERY notification once access is granted — even when the app is killed.
 * Must stay lightweight (no UI) and never throw.
 *
 * v2 capture pipeline:
 *   1. record to a debug ring buffer (the in-app debug screen reads this)
 *   2. gate: looksFinancial? if not, stop (no AI call, nothing sent)
 *   3. dedupe locally (per-notification hash) — skip if already handled
 *   4. try on-device regex parse; else mark for server AI
 *   5. POST to /api/capture (deviceId-authed); on failure, queue for retry
 */

const DEBUG_LOG_KEY = 'notif_debug_log';
const DEBUG_LOG_MAX = 80;
const PROCESSED_KEY = 'notif_processed_hashes';
const PROCESSED_MAX = 500;
const QUEUE_KEY = 'notif_capture_queue';
const QUEUE_MAX = 100;

export interface CapturedNotification {
  app: string;
  title: string;
  text: string;
  time: number;
  capturedAt: number;
}

type HeadlessTaskData = { notification?: string | Record<string, unknown> };
type CaptureBody = {
  deviceId: string;
  hash: string;
  localDate: string;
  parsed?: { amount: number; category: string; note: string; date: string };
  raw?: { sender: string; title: string; text: string };
};

function coerceNotification(raw: HeadlessTaskData['notification']): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function headlessNotificationListener(taskData: HeadlessTaskData): Promise<void> {
  try {
    const n = coerceNotification(taskData?.notification);
    if (!n) return;

    const entry: CapturedNotification = {
      app: String(n.app ?? ''),
      title: String(n.title ?? n.titleBig ?? ''),
      text: String(n.text ?? n.bigText ?? n.subText ?? ''),
      time: Number(n.time ?? 0),
      capturedAt: Date.now(),
    };

    // Ignore our own notifications (scheduled report pings).
    if (entry.app === 'com.hisaabit.app') return;

    await appendDebugLog(entry);

    // Opportunistically drain any queued captures (e.g. from an offline burst).
    await flushCaptureQueue();

    await processCapture(entry);
  } catch {
    // Headless tasks must never throw.
  }
}

async function processCapture(entry: CapturedNotification): Promise<void> {
  const input: NotificationInput = { app: entry.app, title: entry.title, text: entry.text, time: entry.time };
  if (!looksFinancial(input)) return;

  const dayKey = localDayKey(new Date());
  const hash = await dedupeHash(input, dayKey);
  if (await isProcessed(hash)) return;

  const parsed = parseOnDevice(input, dayKey);
  const deviceId = await getOrCreateDeviceId();
  const body: CaptureBody = parsed
    ? { deviceId, hash, localDate: dayKey, parsed }
    : { deviceId, hash, localDate: dayKey, raw: { sender: input.app, title: input.title, text: input.text } };

  const ok = await postCapture(body);
  if (ok) {
    await markProcessed(hash);
  } else {
    await enqueue(body);
  }
}

async function postCapture(body: CaptureBody): Promise<boolean> {
  try {
    const url = new URL('/api/capture', getApiUrl()).toString();
    const res = await globalThis.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Retry queued captures (failed POSTs). Safe to call on app launch/focus. */
export async function flushCaptureQueue(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue: CaptureBody[] = raw ? JSON.parse(raw) : [];
    if (queue.length === 0) return;

    const remaining: CaptureBody[] = [];
    for (const body of queue) {
      const ok = await postCapture(body);
      if (ok) {
        await markProcessed(body.hash);
      } else {
        remaining.push(body);
      }
    }
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  } catch {
    // leave the queue as-is; retried next time
  }
}

// ─── Local stores ────────────────────────────────────────────────

async function appendDebugLog(entry: CapturedNotification): Promise<void> {
  const raw = await AsyncStorage.getItem(DEBUG_LOG_KEY);
  const log: CapturedNotification[] = raw ? JSON.parse(raw) : [];
  log.unshift(entry);
  await AsyncStorage.setItem(DEBUG_LOG_KEY, JSON.stringify(log.slice(0, DEBUG_LOG_MAX)));
}

async function isProcessed(hash: string): Promise<boolean> {
  const raw = await AsyncStorage.getItem(PROCESSED_KEY);
  const arr: string[] = raw ? JSON.parse(raw) : [];
  return arr.includes(hash);
}

async function markProcessed(hash: string): Promise<void> {
  const raw = await AsyncStorage.getItem(PROCESSED_KEY);
  let arr: string[] = raw ? JSON.parse(raw) : [];
  if (!arr.includes(hash)) {
    arr.unshift(hash);
    arr = arr.slice(0, PROCESSED_MAX);
    await AsyncStorage.setItem(PROCESSED_KEY, JSON.stringify(arr));
  }
}

async function enqueue(body: CaptureBody): Promise<void> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  let queue: CaptureBody[] = raw ? JSON.parse(raw) : [];
  queue.push(body);
  queue = queue.slice(-QUEUE_MAX);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

// ─── Debug screen helpers ────────────────────────────────────────

export async function getCapturedNotifications(): Promise<CapturedNotification[]> {
  try {
    const raw = await AsyncStorage.getItem(DEBUG_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function clearCapturedNotifications(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DEBUG_LOG_KEY);
  } catch {
    // non-fatal
  }
}
