import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from './api';

/** Registers for push and sends the Expo token to the API (blueprint §18.3). Push payloads never contain PHI. */
export async function registerForPush(): Promise<void> {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', { name: 'default', importance: Notifications.AndroidImportance.HIGH });
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  await api().notifications.registerDevice(token, Platform.OS === 'ios' ? 'ios' : 'android');
}
