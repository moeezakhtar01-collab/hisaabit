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

// Check if the native ads module is available (not available in Expo Go)
let adsModule: any = null;
try {
  adsModule = require('react-native-google-mobile-ads');
} catch {
  // Native module not available (Expo Go) — ads will be disabled
}

export const ADS_AVAILABLE = adsModule !== null;

/**
 * Get the BannerAd component (or null if not available)
 */
export function getBannerAdComponent() {
  return adsModule?.BannerAd ?? null;
}

export function getBannerAdSize() {
  return adsModule?.BannerAdSize ?? null;
}

export function getTestIds() {
  return adsModule?.TestIds ?? {};
}

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

/**
 * Try to show an interstitial ad. No-ops if native module isn't available.
 */
export async function maybeShowInterstitial(adsRemoved?: boolean): Promise<void> {
  if (adsRemoved || Platform.OS === 'web' || !ADS_AVAILABLE) return;

  try {
    const shouldShow = await trackSaveAndCheckInterstitial();
    if (shouldShow) {
      const { InterstitialAd, AdEventType, TestIds } = adsModule;
      const adUnitId = __DEV__ ? TestIds.INTERSTITIAL : AD_INTERSTITIAL_ID;
      const interstitial = InterstitialAd.createForAdRequest(adUnitId);
      interstitial.addAdEventListener(AdEventType.LOADED, () => interstitial.show());
      interstitial.load();
    }
  } catch {
    // Ad failed — silently ignore
  }
}
