import AsyncStorage from '@react-native-async-storage/async-storage';

const SAVE_COUNT_KEY = 'ad_expense_save_count';
const INTERSTITIAL_INTERVAL = 4;

export const AD_BANNER_ID = '';
export const AD_INTERSTITIAL_ID = '';
export const ADS_AVAILABLE = false;

export function getBannerAdComponent() {
  return null;
}

export function getBannerAdSize() {
  return null;
}

export function getTestIds() {
  return {};
}

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

export async function maybeShowInterstitial(_adsRemoved?: boolean): Promise<void> {
  return;
}
