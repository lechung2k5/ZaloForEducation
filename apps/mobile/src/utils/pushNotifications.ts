import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { apiDelete, apiPost } from './api';
import { getDeviceId } from './deviceId';

let registeredToken: string | null = null;
const PUSH_TOKEN_STORAGE_KEY = 'expoPushToken';

export async function registerDevicePushToken() {
  if (Platform.OS === 'web') return null;

  await ensureDefaultNotificationChannel();

  if (!Device.isDevice) {
    console.log('[PushNotifications] Push notifications require a physical device.');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[PushNotifications] Notification permission was not granted.');
    return null;
  }

  try {
    const tokenResult = await Notifications.getExpoPushTokenAsync();
    const token = tokenResult.data;
    const deviceId = await getDeviceId();

    await apiPost('/users/push-token', {
      token,
      deviceId,
      platform: Platform.OS,
    });

    registeredToken = token;
    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
    return token;
  } catch (error) {
    console.warn('[PushNotifications] Failed to register push token:', error);
    return null;
  }
}

export async function unregisterDevicePushToken() {
  const token = registeredToken || await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  if (!token) return;

  try {
    await apiDelete('/users/push-token', {
      token,
      deviceId: await getDeviceId(),
      platform: Platform.OS,
    });
  } catch (error) {
    console.warn('[PushNotifications] Failed to unregister push token:', error);
  } finally {
    registeredToken = null;
    await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
  }
}

export async function ensureDefaultNotificationChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'Thông báo',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#2563eb',
  });
}
