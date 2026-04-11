const { withAndroidManifest } = require("expo/config-plugins");

/**
 * Expo config plugin that adds READ_SMS and RECEIVE_SMS permissions
 * to the Android manifest for SMS expense parsing.
 */
function withSmsPermission(config) {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const manifest = androidManifest.manifest;

    // Ensure permissions array exists
    if (!manifest["uses-permission"]) {
      manifest["uses-permission"] = [];
    }

    const permissions = manifest["uses-permission"];

    const requiredPermissions = [
      "android.permission.READ_SMS",
      "android.permission.RECEIVE_SMS",
    ];

    for (const perm of requiredPermissions) {
      const exists = permissions.some(
        (p) => p.$?.["android:name"] === perm
      );
      if (!exists) {
        permissions.push({
          $: { "android:name": perm },
        });
      }
    }

    return config;
  });
}

module.exports = withSmsPermission;
