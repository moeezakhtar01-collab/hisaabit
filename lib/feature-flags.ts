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
 * Monetisation roadmap (3 phases):
 *
 *   Phase 1 (NOW, v1.0): App is fully free. No ads, no IAP, no usage caps.
 *     Goal: install volume + Play Store credibility + reviews. Target ~10k
 *     installs before flipping any monetisation switch.
 *
 *   Phase 2 (v1.1): Turn on AdMob banner + interstitial ads. Pure-ads
 *     revenue while we build the Plus infrastructure. No ad-removal IAP —
 *     the only way to skip ads will be Phase 3's Plus tier (this avoids
 *     Play Billing complexity and the audit's "ads without remove-ads is
 *     worse UX" trap; Plus *is* the remove-ads path).
 *
 *   Phase 3 (v1.2): Launch Hisaabit Plus. Web-purchased tier on
 *     hisaabit.com via Safepay (JazzCash / EasyPaisa / cards), Rs. 999
 *     lifetime. Plus users get: ads off, family sharing, SMS auto-parse,
 *     multi-device sync, monthly PDF reports, custom categories, cloud
 *     backup. Buyer persona = 38-year-old salaried married father; growth
 *     engine = 25–32-year-old urban couples discovering and recommending.
 *
 * ---------------------------------------------------------------------------
 * STORE_ENABLED — legacy in-app-purchase UI (remove ads, buy voice credits).
 *
 * This flag governs the original IAP plan we abandoned: Play Billing for ad
 * removal + voice credit packs. That plan never shipped — `/api/purchase`
 * was deleted in the v1.0 hygiene pass, voice has no usage cap, and ads are
 * not bundled.
 *
 * Stays `false`. The (unreachable) subscription.tsx screen is kept only so
 * deep-links to `/subscription` hit its `<Redirect>` instead of a 404. Both
 * the flag and the screen will be removed in Phase 3 alongside the legacy
 * users columns (subscriptionPlan, voiceCreditsPurchased, voiceUsageCount).
 * `adsRemoved` survives Phase 3 — it's the column the Plus webhook will set
 * to gate ads off for paying users.
 *
 * Phase 3 architecture (when we build Plus):
 *   - DB: extend `users` with plus_active / plus_tier / plus_expires_at,
 *     add `purchases` audit table
 *   - Server: 4 endpoints — POST /api/checkout/init, POST /api/checkout/
 *     webhook (Safepay-signed, idempotent), GET /api/me/entitlement,
 *     POST /api/checkout/verify (fallback for missed webhooks)
 *   - Web: hisaabit.com/upgrade marketing + checkout page; sign-in BEFORE
 *     checkout so the order is tied to a known user_id
 *   - App: text-only "Available at hisaabit.com" card in Settings (Play
 *     anti-steering compliance — no clickable link), Plus badge on profile,
 *     entitlement-gated feature unlocks
 *   - Pakistan onboarding prereqs: NTN (FBR online), sole-prop current
 *     account (HBL/Meezan/UBL), Safepay merchant signup (~2-3 weeks total).
 *     Sandbox integration can be built in parallel with the bureaucracy.
 * ---------------------------------------------------------------------------
 * ADS_ENABLED — AdMob banner + interstitial ads.
 *
 * Off for v1.0 (Phase 1). Will flip to true in Phase 2 once we have ~10k
 * installs and a live Play listing (real AdMob IDs are only issued after
 * the app is published, chicken-and-egg).
 *
 * To turn on for Phase 2:
 *   1. Create AdMob account, link to the published Play app listing
 *   2. Create banner + interstitial ad units, copy real IDs into app.json +
 *      lib/ad-manager.ts (replace ca-app-pub-3940256099942544/* test IDs)
 *   3. Add react-native-google-mobile-ads plugin back to app.json
 *   4. Flip ADS_ENABLED to true
 *   5. Verify on a real Android build (test IDs render placeholders only)
 *
 * Phase 3 behaviour: ads keep showing for free users. Plus users get
 * `user.adsRemoved = true` set by the Safepay webhook → the existing
 * `!user?.adsRemoved` check in ad-manager.ts hides ads for them.
 * ---------------------------------------------------------------------------
 */
export const SMS_ENABLED: boolean = false;
// v2 pivot: notification parsing is now the PRIMARY capture path (Phase 0 spike
// active). Android-only; delivery is via the headless task in lib/notification-task.ts.
export const NOTIFICATION_LISTENER_ENABLED: boolean = true;
export const STORE_ENABLED: boolean = false;
export const ADS_ENABLED: boolean = false;
