import { Platform } from 'react-native';
import { SMS_ENABLED } from '@/lib/feature-flags';

/**
 * SMS Listener — STUB for v1 Play Store submission.
 *
 * The real implementation has been temporarily removed because:
 *   1. The `react-native-android-sms-listener` npm package is uninstalled
 *      in v1. Its AndroidManifest.xml declares <uses-permission
 *      android:name="android.permission.RECEIVE_SMS"/>, and Expo's
 *      autolinking merges that permission into our final APK manifest.
 *      Once RECEIVE_SMS is in the manifest, Play treats the app as an
 *      SMS-using app and requires a Permissions Declaration (restricted
 *      use case form) — which we are deferring until v1.1.
 *   2. SMS_ENABLED is gated off in lib/feature-flags.ts, so all callsites
 *      (_layout.tsx init, sms-settings.tsx UI, sms-expenses.tsx list)
 *      already early-return before invoking any function here.
 *
 * To restore SMS listening in v1.1 (or swap to a notification-listener):
 *   1. `npm install react-native-android-sms-listener` (or chosen alternative)
 *   2. Add a config plugin back to app.json that writes RECEIVE_SMS into
 *      AndroidManifest (see plugins/withSmsPermission.js — still in repo)
 *   3. Restore this file from git: `git show 7ec1b3b:lib/sms-listener.ts`
 *   4. Flip SMS_ENABLED to true in lib/feature-flags.ts
 *   5. Submit the SMS Permissions Declaration in Play Console before
 *      submitting the v1.1 AAB (Play rejects releases with RECEIVE_SMS
 *      that have not declared an approved use case).
 *
 * Git reference for the original implementation: git show aabab49:lib/sms-listener.ts
 */

export function startSmsListener(_onExpenseDetected?: (count: number) => void): void {
  if (Platform.OS !== 'android') return;
  if (!SMS_ENABLED) return;
  // No-op: package uninstalled for v1.
}

export function stopSmsListener(): void {
  // No-op: no active subscription in v1.
}

export function isSmsListenerActive(): boolean {
  return false;
}
