import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NOTIFICATION_LISTENER_ENABLED } from './feature-flags';

/**
 * Wrapper around `react-native-android-notification-listener` (Android only).
 *
 * IMPORTANT — delivery model: this package has NO foreground JS event emitter.
 * Every captured notification is delivered to a HEADLESS task (registered in
 * index.js, handled in lib/notification-task.ts), which runs even when the app
 * is backgrounded or killed. So there is no "start listener" call to make from
 * a screen — once the user grants Notification Access in Android Settings, the
 * OS-bound NotificationListenerService fires the headless task on its own.
 *
 * This module therefore only handles: permission status/request, the user's
 * opt-in flag, and a best-effort "active" indicator for the settings UI.
 *
 * The native module is required lazily so iOS/web bundles never touch it.
 */

const ENABLED_CACHE_KEY = 'notification_listener_enabled';

type PermissionStatus = 'unknown' | 'authorized' | 'denied';

interface NativeListener {
  getPermissionStatus: () => Promise<PermissionStatus>;
  requestPermission: () => void;
}

// Best-effort, synchronously-readable "is it working" flag for the settings
// screen. Updated by refreshListenerActive() / initNotificationListener().
let listenerActive = false;

function loadNativeModule(): NativeListener | null {
  if (!NOTIFICATION_LISTENER_ENABLED) return null;
  if (Platform.OS !== 'android') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-android-notification-listener').default;
    return mod ?? null;
  } catch {
    return null;
  }
}

/** Has the user granted Hisaabit Notification Access in Android Settings? */
export async function hasNotificationAccess(): Promise<boolean> {
  const native = loadNativeModule();
  if (!native?.getPermissionStatus) return false;
  try {
    return (await native.getPermissionStatus()) === 'authorized';
  } catch {
    return false;
  }
}

/**
 * Open Android's Notification Access settings page for Hisaabit. Android does
 * NOT allow an in-app permission prompt for this — the system screen is the
 * only path. Returns true if the request was dispatched.
 */
export async function openNotificationAccessSettings(): Promise<boolean> {
  const native = loadNativeModule();
  if (!native?.requestPermission) return false;
  try {
    native.requestPermission();
    return true;
  } catch {
    return false;
  }
}

/** Persist the user's opt-in choice. Capture itself is gated on this flag. */
export async function setNotificationListenerEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(ENABLED_CACHE_KEY, String(enabled));
  await refreshListenerActive();
}

export async function isNotificationListenerEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ENABLED_CACHE_KEY)) === 'true';
  } catch {
    return false;
  }
}

/** Synchronous best-effort status for the settings UI. */
export function isListenerActive(): boolean {
  return listenerActive;
}

async function refreshListenerActive(): Promise<boolean> {
  if (!NOTIFICATION_LISTENER_ENABLED || Platform.OS !== 'android') {
    listenerActive = false;
    return false;
  }
  const [enabled, granted] = await Promise.all([
    isNotificationListenerEnabled(),
    hasNotificationAccess(),
  ]);
  listenerActive = enabled && granted;
  return listenerActive;
}

/**
 * Called from AuthGate after login. There is no emitter to start (delivery is
 * headless), so this just refreshes the active indicator. Safe no-op while the
 * flag is off, on non-Android, or before access is granted.
 */
export async function initNotificationListener(): Promise<boolean> {
  return refreshListenerActive();
}

export function teardownNotificationListener(): void {
  listenerActive = false;
}
