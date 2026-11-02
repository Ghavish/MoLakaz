import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { api } from './api';

export async function registerPush(hid: string, me: string) {
  // expo go can't get remote push tokens anymore, and web doesn't do expo push. needs a dev build
  if (Platform.OS === 'web' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return;

  try {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Chores',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;

    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) return; // run `npx eas-cli init` once to get one
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await api.pushToken(hid, me, token);
  } catch (e) {
    console.log('push setup skipped:', e);
  }
}
