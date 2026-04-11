import { Platform, PermissionsAndroid } from 'react-native';

/**
 * Request RECEIVE_SMS permission on Android.
 * Returns true if granted, false otherwise.
 * On non-Android platforms, always returns false.
 */
export async function requestSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  try {
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      PermissionsAndroid.PERMISSIONS.READ_SMS,
    ]);
    return (
      results[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] === PermissionsAndroid.RESULTS.GRANTED &&
      results[PermissionsAndroid.PERMISSIONS.READ_SMS] === PermissionsAndroid.RESULTS.GRANTED
    );
  } catch {
    return false;
  }
}

/**
 * Check if RECEIVE_SMS permission is already granted.
 */
export async function hasSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  try {
    const receive = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS);
    const read = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
    return receive && read;
  } catch {
    return false;
  }
}
