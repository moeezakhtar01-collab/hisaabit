import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

/**
 * Stable per-install device id — the only "credential" a frictionless
 * anonymous account has. Generated once on first launch and reused forever
 * (until the app is uninstalled / storage cleared), so the same account
 * resumes on every launch. Works on native + web (Crypto.randomUUID).
 */
const DEVICE_ID_KEY = 'hisaabit:deviceId';

export async function getOrCreateDeviceId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
  } catch {
    // fall through to create
  }
  const id = Crypto.randomUUID();
  try {
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  } catch {
    // Non-fatal: a non-persisted id still works for this session; next launch
    // just mints a new anonymous account. Rare (storage failure).
  }
  return id;
}
