import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Headless task handler for incoming notifications (Android only).
 *
 * Registered in the bundle entry (index.js) via AppRegistry.registerHeadlessTask.
 * Android spins up a short-lived JS context and calls this for EVERY notification
 * once the user has granted Notification Access — including when the app is
 * backgrounded or killed. It must stay lightweight (no UI, no heavy imports) and
 * must never throw: an unhandled rejection here kills the task silently.
 *
 * ── PHASE 0 (current): pure capture spike ──────────────────────────────────
 * We log the raw notification (app package, title, text, time) into an
 * AsyncStorage ring buffer so the in-app debug screen can prove capture works
 * on a real device under SDK 54 + New Architecture, and so we can discover the
 * exact package names + text formats of Pakistani bank/wallet apps. NOTHING is
 * sent off the device and NO parsing happens yet.
 *
 * ── PHASE 1 (next): on-device parse + auto-save ────────────────────────────
 * Replace the "log everything" body with: filter by financial-app allowlist →
 * run the on-device parser → dedupe → POST only the structured expense
 * {amount, category, date, source, sourceLabel, hash} to the server. The raw
 * text still never leaves the phone.
 */

// Debug ring buffer. Capped so a chatty device can't grow storage unbounded.
const DEBUG_LOG_KEY = 'notif_debug_log';
const DEBUG_LOG_MAX = 80;

export interface CapturedNotification {
  /** Sender package name, e.g. "com.techlogix.mobilinkcustomer" (JazzCash). */
  app: string;
  title: string;
  text: string;
  /** Sender-reported post time (ms epoch), may be 0 if absent. */
  time: number;
  /** When our task recorded it (ms epoch). */
  capturedAt: number;
}

/**
 * The native module hands us `notification` as a JSON string. Field set depends
 * on the sender, so most can be empty (see the package README). We defensively
 * accept either a string or an already-parsed object.
 */
type HeadlessTaskData = { notification?: string | Record<string, unknown> };

function coerceNotification(raw: HeadlessTaskData['notification']): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function headlessNotificationListener(taskData: HeadlessTaskData): Promise<void> {
  try {
    const n = coerceNotification(taskData?.notification);
    if (!n) return;

    const entry: CapturedNotification = {
      app: String(n.app ?? ''),
      title: String(n.title ?? n.titleBig ?? ''),
      // bigText / text are the usual carriers of the transaction line.
      text: String(n.text ?? n.bigText ?? n.subText ?? ''),
      time: Number(n.time ?? 0),
      capturedAt: Date.now(),
    };

    // Ignore our own notifications (the scheduled weekly/monthly report pings)
    // so the debug log isn't polluted by Hisaabit talking to itself.
    if (entry.app === 'com.hisaabit.app') return;

    const existingRaw = await AsyncStorage.getItem(DEBUG_LOG_KEY);
    const log: CapturedNotification[] = existingRaw ? JSON.parse(existingRaw) : [];
    log.unshift(entry);
    await AsyncStorage.setItem(DEBUG_LOG_KEY, JSON.stringify(log.slice(0, DEBUG_LOG_MAX)));
  } catch {
    // Swallow — a headless task must never throw.
  }
}

/** Read the captured-notification debug buffer (newest first). */
export async function getCapturedNotifications(): Promise<CapturedNotification[]> {
  try {
    const raw = await AsyncStorage.getItem(DEBUG_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Clear the captured-notification debug buffer. */
export async function clearCapturedNotifications(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DEBUG_LOG_KEY);
  } catch {
    // non-fatal
  }
}
