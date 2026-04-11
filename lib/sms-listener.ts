import { Platform } from 'react-native';
import { isBankTransactionSms } from './sms-bank-filter';
import { processSmsMessages } from './sms-storage';

type Subscription = { remove: () => void };

let activeSubscription: Subscription | null = null;

/**
 * Start listening for incoming SMS messages in real-time.
 * When a bank transaction SMS is detected, it's immediately sent
 * to the server for AI parsing and pending expense creation.
 *
 * Uses a BroadcastReceiver under the hood — works while the app
 * is in the foreground or background.
 *
 * @param onExpenseDetected Optional callback when a new pending expense is created.
 */
export function startSmsListener(onExpenseDetected?: (count: number) => void): void {
  if (Platform.OS !== 'android') return;
  if (activeSubscription) return; // already listening

  try {
    const SmsListener = require('react-native-android-sms-listener').default;

    activeSubscription = SmsListener.addListener(
      async (message: { originatingAddress: string; body: string; timestamp: number }) => {
        try {
          const sender = message.originatingAddress || '';
          const body = message.body || '';

          // Quick local filter — skip non-bank SMS immediately
          if (!isBankTransactionSms(sender, body)) return;

          // Bank transaction detected — send to server for AI parsing
          const result = await processSmsMessages([
            {
              sender,
              body,
              timestamp: message.timestamp || Date.now(),
            },
          ]);

          if (result.pending > 0 && onExpenseDetected) {
            onExpenseDetected(result.pending);
          }
        } catch (err) {
          console.warn('SMS listener processing error:', err);
        }
      }
    );
  } catch (err) {
    console.warn('SMS listener not available:', err);
  }
}

/**
 * Stop listening for incoming SMS messages.
 */
export function stopSmsListener(): void {
  if (activeSubscription) {
    activeSubscription.remove();
    activeSubscription = null;
  }
}

/**
 * Check if the SMS listener is currently active.
 */
export function isSmsListenerActive(): boolean {
  return activeSubscription !== null;
}
