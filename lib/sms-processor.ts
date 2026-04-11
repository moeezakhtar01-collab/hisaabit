import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hasSmsPermission } from './sms-reader';
import { startSmsListener, stopSmsListener, isSmsListenerActive } from './sms-listener';
import { getSmsSettings } from './sms-storage';

const SMS_ENABLED_KEY = 'sms_parsing_enabled';

/**
 * Initialize the real-time SMS listener if SMS parsing is enabled
 * and permissions are granted. Call this when the user logs in
 * or when the app starts.
 *
 * @param onExpenseDetected Callback fired when a bank SMS is processed
 *                          and a new pending expense is created.
 */
export async function initSmsListener(
  onExpenseDetected?: (count: number) => void
): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  try {
    // Check local cache first (fast path)
    let enabled = false;
    const cachedEnabled = await AsyncStorage.getItem(SMS_ENABLED_KEY);

    if (cachedEnabled !== null) {
      enabled = cachedEnabled === 'true';
    } else {
      // No cache — fetch from server
      const settings = await getSmsSettings();
      enabled = settings.smsParsingEnabled;
      await AsyncStorage.setItem(SMS_ENABLED_KEY, String(enabled));
    }

    if (!enabled) {
      stopSmsListener();
      return false;
    }

    // Check permissions
    const hasPermission = await hasSmsPermission();
    if (!hasPermission) {
      stopSmsListener();
      return false;
    }

    // Start the real-time listener
    if (!isSmsListenerActive()) {
      startSmsListener(onExpenseDetected);
    }

    return true;
  } catch (err) {
    console.warn('SMS listener init error:', err);
    return false;
  }
}

/**
 * Tear down the SMS listener. Call on logout or when disabling SMS parsing.
 */
export function teardownSmsListener(): void {
  stopSmsListener();
}

/**
 * Update the local SMS enabled cache and start/stop the listener accordingly.
 * Call this when the user toggles SMS parsing in settings.
 */
export async function setSmsEnabledCache(
  enabled: boolean,
  onExpenseDetected?: (count: number) => void
): Promise<void> {
  await AsyncStorage.setItem(SMS_ENABLED_KEY, String(enabled));

  if (enabled) {
    await initSmsListener(onExpenseDetected);
  } else {
    stopSmsListener();
  }
}
