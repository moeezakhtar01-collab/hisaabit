/**
 * Compile-time feature flags for Hisaabit.
 *
 * SMS_ENABLED: turned off for v1 Play Store submission to avoid the restricted
 * READ_SMS/RECEIVE_SMS permissions declaration. Server routes, DB tables, and
 * all SMS parsing code are kept intact — only UI entry points and the real-time
 * listener are gated.
 *
 * To re-enable in v1.1:
 *   1. Flip SMS_ENABLED to true
 *   2. Add the SMS plugin (or a notification-listener replacement) back to app.json
 *   3. Verify react-native-android-sms-listener resolves in the prod bundle
 *   4. Test permission prompt flow end-to-end on a physical Android device
 */
export const SMS_ENABLED: boolean = false;
