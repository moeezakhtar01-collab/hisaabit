import { Platform, Linking, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NOTIFICATION_LISTENER_ENABLED } from './feature-flags';

/**
 * Thin wrapper around Android's NotificationListenerService — scaffolding
 * for the v1.1 rollout. Until NOTIFICATION_LISTENER_ENABLED flips to true
 * AND the native package is installed, every function here either no-ops
 * or returns a safe default. No native code is touched, so this module is
 * safe to import from the bundle at all times.
 *
 * When you flip the flag in v1.1:
 *   1. `bun add react-native-android-notification-listener`
 *   2. Update `loadNativeModule()` below to return the actual module
 *   3. Add "./plugins/withNotificationListener" to app.json plugins
 *   4. Wire `startListener` / `stopListener` to the real native event API
 *      (the default package exposes `RNAndroidNotificationListener` with
 *      `onNotificationReceived` events — see its README)
 *   5. Build + test on a physical Android device
 *
 * Design goal: the public surface of this file matches what the settings
 * screen and AuthGate already import, so flipping the flag is purely an
 * implementation swap — no call-site changes needed.
 */

const ENABLED_CACHE_KEY = 'notification_listener_enabled';

/**
 * Lazily resolve the native notification-listener module. Returns null if
 * the package isn't installed (which is always true in v1). This isolation
 * means a missing package degrades to a no-op instead of a crash.
 */
function loadNativeModule(): unknown | null {
  if (!NOTIFICATION_LISTENER_ENABLED) return null;
  if (Platform.OS !== 'android') return null;

  // v1.1 TODO: replace with a direct `import` once the package is installed.
  // Kept as NativeModules lookup so TypeScript doesn't try to resolve a
  // missing module at build time.
  try {
    return NativeModules.RNAndroidNotificationListener ?? null;
  } catch {
    return null;
  }
}

/**
 * Check whether the user has granted Hisaabit notification-access in
 * Android Settings. Returns false on iOS, web, or while the feature flag
 * is off. In v1.1 this should delegate to the native module's status check.
 */
export async function hasNotificationAccess(): Promise<boolean> {
  if (!NOTIFICATION_LISTENER_ENABLED) return false;
  if (Platform.OS !== 'android') return false;

  const native = loadNativeModule() as
    | { getPermissionStatus?: () => Promise<string> }
    | null;

  if (!native?.getPermissionStatus) return false;

  try {
    const status = await native.getPermissionStatus();
    return status === 'authorized';
  } catch {
    return false;
  }
}

/**
 * Deep-link the user to Android's Notification Access settings page, where
 * they flip the toggle for Hisaabit. Android does NOT allow an in-app
 * permission prompt for this — the system screen is the only path. Returns
 * true if the settings page was opened successfully.
 */
export async function openNotificationAccessSettings(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  try {
    // Intent action that takes the user straight to the Notification Access list.
    await Linking.sendIntent(
      'android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS'
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Start listening for incoming notifications. No-op while the flag is off
 * or the native module is missing.
 *
 * @param onNotification Callback receiving raw notification payloads. The
 *        screen should pipe these into the existing expense-parsing
 *        pipeline (reuse lib/sms-bank-filter.ts — bank notification text
 *        is near-identical to bank SMS text in most cases).
 */
export function startListener(
  onNotification?: (payload: NotificationPayload) => void
): boolean {
  if (!NOTIFICATION_LISTENER_ENABLED) return false;
  if (Platform.OS !== 'android') return false;

  const native = loadNativeModule();
  if (!native) return false;

  // v1.1 TODO: subscribe to the native event emitter here. Example:
  //   import { NativeEventEmitter } from 'react-native';
  //   const emitter = new NativeEventEmitter(native);
  //   emitter.addListener('onNotificationReceived', onNotification);
  // Store the subscription handle in a module-level variable so
  // stopListener() can remove it.

  return true;
}

export function stopListener(): void {
  // v1.1 TODO: remove the subscription registered in startListener.
}

export function isListenerActive(): boolean {
  // v1.1 TODO: return whether a subscription is currently registered.
  return false;
}

/**
 * Boot the listener if the user has opted in and granted access. Call this
 * from AuthGate once the user is logged in. Mirrors initSmsListener().
 */
export async function initNotificationListener(
  onNotification?: (payload: NotificationPayload) => void
): Promise<boolean> {
  if (!NOTIFICATION_LISTENER_ENABLED) return false;
  if (Platform.OS !== 'android') return false;

  try {
    const cached = await AsyncStorage.getItem(ENABLED_CACHE_KEY);
    const enabled = cached === 'true';
    if (!enabled) {
      stopListener();
      return false;
    }

    const granted = await hasNotificationAccess();
    if (!granted) {
      stopListener();
      return false;
    }

    if (!isListenerActive()) {
      startListener(onNotification);
    }

    return true;
  } catch (err) {
    console.warn('Notification listener init error:', err);
    return false;
  }
}

export function teardownNotificationListener(): void {
  stopListener();
}

/**
 * Persist the user's opt-in choice and start/stop the listener.
 * Call this when the toggle in the settings screen flips.
 */
export async function setNotificationListenerEnabled(
  enabled: boolean,
  onNotification?: (payload: NotificationPayload) => void
): Promise<void> {
  await AsyncStorage.setItem(ENABLED_CACHE_KEY, String(enabled));
  if (enabled) {
    await initNotificationListener(onNotification);
  } else {
    stopListener();
  }
}

/**
 * Shape of a notification event from the native layer. The v1.1 native
 * package surfaces more fields (icons, actions, extras); we only type the
 * ones the expense parser needs. Extend as needed.
 */
export interface NotificationPayload {
  packageName: string;
  title: string;
  text: string;
  subText?: string;
  time: number;
}
