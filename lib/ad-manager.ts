import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const SAVE_COUNT_KEY = 'ad_expense_save_count';
const INTERSTITIAL_INTERVAL = 4;

// Google AdMob test IDs — replace with real IDs before production
export const AD_BANNER_ID = Platform.select({
  ios: 'ca-app-pub-3940256099942544/2934735716',
  android: 'ca-app-pub-3940256099942544/6300978111',
  default: 'ca-app-pub-3940256099942544/6300978111',
});

export const AD_INTERSTITIAL_ID = Platform.select({
  ios: 'ca-app-pub-3940256099942544/4411468910',
  android: 'ca-app-pub-3940256099942544/1033173712',
  default: 'ca-app-pub-3940256099942544/1033173712',
});

/**
 * Increment the save counter and return whether an interstitial should show.
 * Shows every INTERSTITIAL_INTERVAL saves (4th, 8th, 12th, etc.)
 */
export async function trackSaveAndCheckInterstitial(): Promise<boolean> {
  try {
    const current = await AsyncStorage.getItem(SAVE_COUNT_KEY);
    const count = (parseInt(current || '0', 10) || 0) + 1;
    await AsyncStorage.setItem(SAVE_COUNT_KEY, String(count));
    return count % INTERSTITIAL_INTERVAL === 0;
  } catch {
    return false;
  }
}
