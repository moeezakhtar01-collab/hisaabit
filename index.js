// Custom entry point.
//
// Expo Router normally registers the root component via "expo-router/entry"
// (the previous `main` in package.json). We keep that — the first import
// below runs its side effects and registers the app exactly as before.
//
// On top of that we register the Android NotificationListener HEADLESS task.
// This is what lets Hisaabit capture bank/wallet notifications even when the
// app is backgrounded or killed: Android starts a short-lived JS context and
// runs the task named below for each captured notification. The task must be
// registered here, in the bundle entry, because the headless context loads
// this same entry — registering it inside a screen would be too late.
import 'expo-router/entry';

import { AppRegistry, Platform } from 'react-native';

if (Platform.OS === 'android') {
  // Loaded lazily so iOS/web bundles never touch the Android-only native module.
  const {
    RNAndroidNotificationListenerHeadlessJsName,
  } = require('react-native-android-notification-listener');
  const { headlessNotificationListener } = require('./lib/notification-task');

  AppRegistry.registerHeadlessTask(
    RNAndroidNotificationListenerHeadlessJsName,
    () => headlessNotificationListener,
  );
}
