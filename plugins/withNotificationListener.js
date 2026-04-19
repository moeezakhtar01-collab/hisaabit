const { withAndroidManifest } = require("expo/config-plugins");

/**
 * Expo config plugin that registers an Android NotificationListenerService
 * so Hisaabit can read bank/wallet push notifications (JazzCash, EasyPaisa,
 * Meezan, UBL, etc.) and draft expenses from them.
 *
 * NOT included in app.json by default — this is v1.1 scaffolding. To activate:
 *   1. Install the native package that implements the service class. The
 *      default name below targets `react-native-android-notification-listener`:
 *        bun add react-native-android-notification-listener
 *      If you pick a different package, update SERVICE_NAME to match the
 *      class it exposes (check the package's AndroidManifest.xml).
 *   2. Add `"./plugins/withNotificationListener"` to the `plugins` array in
 *      app.json.
 *   3. Flip NOTIFICATION_LISTENER_ENABLED to true in lib/feature-flags.ts.
 *   4. Rebuild the APK.
 *
 * What this plugin injects into AndroidManifest.xml:
 *   - BIND_NOTIFICATION_LISTENER_SERVICE permission on the <service>
 *   - intent-filter for android.service.notification.NotificationListenerService
 *   - exported=false to prevent third-party apps from binding to it
 *
 * Google Play policy notes (read before shipping):
 *   - This permission is "Restricted" — Play Store review will manually audit
 *     the listing and may request video/screenshots proving the feature is
 *     core to the app's value proposition.
 *   - The Play listing description MUST mention the notification-access
 *     feature explicitly.
 *   - The privacy policy MUST disclose what data is read and that nothing
 *     leaves the device (or if it does, exactly where it goes).
 */
function withNotificationListener(config) {
  const SERVICE_NAME =
    "com.github.kjudeperera.notificationlistener.NotificationListener";
  const PERMISSION_NAME =
    "android.permission.BIND_NOTIFICATION_LISTENER_SERVICE";
  const INTENT_ACTION =
    "android.service.notification.NotificationListenerService";

  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application?.[0];

    if (!application) {
      throw new Error(
        "withNotificationListener: AndroidManifest.xml has no <application> element"
      );
    }

    if (!application.service) {
      application.service = [];
    }

    const alreadyDeclared = application.service.some(
      (s) => s.$?.["android:name"] === SERVICE_NAME
    );

    if (!alreadyDeclared) {
      application.service.push({
        $: {
          "android:name": SERVICE_NAME,
          "android:label": "Hisaabit Notification Reader",
          "android:permission": PERMISSION_NAME,
          "android:exported": "false",
        },
        "intent-filter": [
          {
            action: [{ $: { "android:name": INTENT_ACTION } }],
          },
        ],
      });
    }

    return config;
  });
}

module.exports = withNotificationListener;
