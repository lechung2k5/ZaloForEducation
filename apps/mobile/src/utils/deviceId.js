import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const DEVICE_ID_KEY = 'app_device_id';

/**
 * Gets a persistent device ID from SecureStore.
 * If not exists, generates a new one and saves it.
 */
export async function getDeviceId() {
  try {
    let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = Crypto.randomUUID();
      await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch (error) {
    console.error('[DEVICE_ID] Error getting/setting deviceId:', error);
    // Fallback if SecureStore fails (e.g. in some web environments without secure context)
    return `fallback-${Math.random().toString(36).slice(2, 9)}`;
  }
}
