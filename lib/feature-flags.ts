/**
 * Compile-time feature flags for Hisaabit.
 *
 * All flags are `: boolean` (not literal) so TypeScript doesn't narrow dead
 * branches into unreachable code — the bundler still tree-shakes gated code
 * because the constant is `false`, but TS stops flagging the branches.
 *
 * ---------------------------------------------------------------------------
 * SMS_ENABLED — SMS expense auto-parsing from bank/telco notifications.
 *
 * Turned off for v1 Play Store submission to avoid the restricted
 * READ_SMS/RECEIVE_SMS permissions declaration. Server routes, DB tables, and
 * all SMS parsing code stay intact — only UI entry points and the real-time
 * listener are gated.
 *
 * To re-enable in v1.1:
 *   1. Flip SMS_ENABLED to true
 *   2. Add the SMS plugin (or a notification-listener replacement) back to app.json
 *   3. Verify react-native-android-sms-listener resolves in the prod bundle
 *   4. Test permission prompt flow end-to-end on a physical Android device
 * ---------------------------------------------------------------------------
 * NOTIFICATION_LISTENER_ENABLED — read bank/wallet push notifications via
 * Android's NotificationListenerService, parse expense details, and queue
 * them as pending expenses for user confirmation.
 *
 * Turned off for v1 Play Store submission. Unlike SMS (which is blanket
 * restricted for expense apps), NotificationListener is *allowed* but
 * heavily scrutinized under Google's "Restricted Permissions" policy:
 *   - must be justified as core functionality in the Play listing
 *   - must be disclosed in privacy policy
 *   - users must toggle it on through Android Settings (system dialog)
 *   - cannot monetize / share the captured data
 *
 * Adding this permission on a brand-new listing typically triggers a
 * 7-14 day manual review, so we keep it off for the initial submission
 * and flip it on in v1.1 once Hisaabit has review credibility.
 *
 * To re-enable in v1.1:
 *   1. Install the native package:
 *        bun add react-native-android-notification-listener
 *      (or another implementation — swap the require in
 *      lib/notification-listener.ts)
 *   2. Add the plugin to app.json "plugins" array:
 *        "./plugins/withNotificationListener"
 *   3. Update the Play Store listing description + privacy policy with
 *      the notification-access disclosure
 *   4. Flip NOTIFICATION_LISTENER_ENABLED to true
 *   5. Rebuild APK and verify the pre-permission screen + system-settings
 *      handoff flow end-to-end on a physical Android device
 * ---------------------------------------------------------------------------
 * STORE_ENABLED — in-app purchases (remove ads, buy voice credits).
 *
 * Turned off for v1 Play Store submission. The current /api/purchase endpoint
 * is a direct DB flag flip with NO payment happening, which violates Play's
 * Payments Policy (all digital goods must go through Google Play Billing).
 * Subscription screen, /api/purchase route, and DB columns (adsRemoved,
 * voiceCreditsPurchased) are kept intact for v1.1.
 *
 * To re-enable in v1.1:
 *   1. Install react-native-iap, configure managed products in Play Console
 *   2. Rewrite subscription.tsx purchase flow to use Play Billing Library
 *   3. Add server-side receipt verification via Google Play Developer API
 *   4. Handle pending/cancelled/refunded purchase states
 *   5. Flip STORE_ENABLED to true
 * ---------------------------------------------------------------------------
 * ADS_ENABLED — AdMob banner + interstitial ads.
 *
 * Turned off for v1 because (a) current app.json uses Google's PUBLIC TEST
 * AdMob App IDs, which violates AdMob policy in production, and (b) real
 * AdMob IDs are only issued after the app is live on Play (chicken-and-egg).
 * Ads without a "Remove Ads" IAP is also a worse UX than no ads, so ADS
 * and STORE flip together.
 *
 * To re-enable in v1.1:
 *   1. Create AdMob account, link to the published Play app listing
 *   2. Create banner + interstitial ad units, copy real IDs into app.json +
 *      lib/ad-manager.ts (replace ca-app-pub-3940256099942544/*)
 *   3. Add react-native-google-mobile-ads plugin back to app.json
 *   4. Flip ADS_ENABLED to true
 *   5. Verify on a real Android build (test IDs won't show anything)
 * ---------------------------------------------------------------------------
 */
export const SMS_ENABLED: boolean = false;
export const NOTIFICATION_LISTENER_ENABLED: boolean = false;
export const STORE_ENABLED: boolean = false;
export const ADS_ENABLED: boolean = false;
