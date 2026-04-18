import { Platform } from 'react-native';
import { ADS_ENABLED } from '@/lib/feature-flags';

/**
 * Ad Manager — STUB for v1 Play Store submission.
 *
 * The real implementation has been temporarily removed because:
 *   1. The `react-native-google-mobile-ads` npm package is uninstalled in v1
 *      (its native MobileAdsInitProvider crashes at app launch without a
 *      valid AdMob APPLICATION_ID in AndroidManifest, and test IDs can't
 *      ship to Play without violating AdMob policy).
 *   2. ADS_ENABLED is gated off in lib/feature-flags.ts, so no callsite
 *      reaches any of these functions anyway.
 *
 * To restore ads in v1.1:
 *   1. `npm install react-native-google-mobile-ads`
 *   2. Add real AdMob App IDs to app.json plugins block:
 *        ["react-native-google-mobile-ads", {
 *          "androidAppId": "ca-app-pub-REAL-ID~XXXXXXXXXX",
 *          "iosAppId":     "ca-app-pub-REAL-ID~XXXXXXXXXX"
 *        }]
 *   3. Restore this file from git history (pre-7ec1b3b) with real ad
 *      unit IDs replacing the Google test IDs.
 *   4. Flip ADS_ENABLED to true in lib/feature-flags.ts.
 *
 * Git reference for the original implementation:
 *   git show 27d8ecb:lib/ad-manager.ts
 */

// Stub ad-unit IDs. Kept so callsites that import these constants still
// compile, but they are never passed to any real SDK.
export const AD_BANNER_ID = Platform.select({
  ios: '',
  android: '',
  default: '',
});

export const AD_INTERSTITIAL_ID = Platform.select({
  ios: '',
  android: '',
  default: '',
});

// Always false in v1 because the package is uninstalled. Typed as plain
// `boolean` (not `false as const`) so TypeScript doesn't mark callsites
// inside `ADS_AVAILABLE && (...)` as unreachable — the real ad-manager in
// v1.1 will flip this to true dynamically, and we want the consumer code
// (app/(tabs)/index.tsx banner render) to stay type-valid in both states.
export const ADS_AVAILABLE: boolean = false;

/**
 * Returns null — no banner component available in v1. Return type is loose
 * (`any`) so JSX usage at callsites still typechecks after the null guard.
 */
export function getBannerAdComponent(): any {
  return null;
}

export function getBannerAdSize(): any {
  return null;
}

export function getTestIds(): any {
  return {};
}

/**
 * Track expense saves for interstitial frequency capping. Kept as a no-op
 * so callsites don't need to be refactored — in v1.1 this will resume
 * incrementing AsyncStorage once ads come back.
 */
export async function trackSaveAndCheckInterstitial(): Promise<boolean> {
  return false;
}

/**
 * No-op in v1. Callsites (add-expense, voice-expense) invoke this after
 * every save; it must remain safe to call unconditionally.
 */
export async function maybeShowInterstitial(_adsRemoved?: boolean): Promise<void> {
  // Intentionally empty — ads disabled for v1.
  // Reference ADS_ENABLED so the import is not flagged as unused by ESLint.
  if (ADS_ENABLED) return;
}
