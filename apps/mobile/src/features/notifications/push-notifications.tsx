import {
  RegisterMobilePushDeviceDocument,
  RevokeMobilePushDeviceDocument,
} from '@boardnest/graphql-types';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { mobileApolloClient } from '@/lib/apollo';
import { mobileEnvironment } from '@/lib/environment';

import {
  mobileNotificationRoute,
  type NotificationRouteContext,
} from './notification-model';

const DEVICE_ID_KEY = 'boardnest.push-device-id';

Notifications.setNotificationHandler({
  handleNotification: () =>
    Promise.resolve({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
});

export function PushNotificationBridge() {
  const router = useRouter();

  useEffect(() => {
    const openResponse = (response: Notifications.NotificationResponse) => {
      const route = mobileNotificationRoute(
        readNotificationContext(
          response.notification.request.content.data ?? {},
        ),
      );
      if (route) router.push(route);
    };
    const subscription =
      Notifications.addNotificationResponseReceivedListener(openResponse);
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) openResponse(response);
    });
    return () => subscription.remove();
  }, [router]);

  return null;
}

export async function enablePushNotifications(): Promise<void> {
  if (!Device.isDevice) {
    throw new Error('Push notifications require a physical device.');
  }
  const projectId =
    mobileEnvironment.easProjectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    throw new Error(
      'Configure EXPO_PUBLIC_EAS_PROJECT_ID before registering push notifications.',
    );
  }
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    throw new Error(
      'Push notifications are supported only on Android and iOS.',
    );
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      importance: Notifications.AndroidImportance.HIGH,
      name: 'Boardnest notifications',
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.granted
    ? existing
    : await Notifications.requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Notification permission was not granted.');
  }

  const token = await Notifications.getExpoPushTokenAsync({
    projectId,
  });
  const result = await mobileApolloClient.mutate({
    mutation: RegisterMobilePushDeviceDocument,
    variables: {
      input: {
        deviceName:
          Device.deviceName ??
          ([Device.brand, Device.modelName].filter(Boolean).join(' ') || null),
        platform: Platform.OS,
        pushToken: token.data,
      },
    },
  });
  const id = result.data?.registerPushDevice.id;
  if (!id) throw new Error('The push device could not be registered.');
  await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
}

export async function disablePushNotifications(): Promise<void> {
  const id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!id) return;
  await mobileApolloClient.mutate({
    mutation: RevokeMobilePushDeviceDocument,
    variables: { id },
  });
  await SecureStore.deleteItemAsync(DEVICE_ID_KEY);
}

export async function hasLocalPushRegistration(): Promise<boolean> {
  return Boolean(await SecureStore.getItemAsync(DEVICE_ID_KEY));
}

function readNotificationContext(
  data: Record<string, unknown>,
): NotificationRouteContext {
  return {
    projectId: readString(data.projectId),
    taskId: readString(data.taskId),
    type: readString(data.eventType) ?? 'workspace.notification',
    workspaceId: readString(data.workspaceId),
  };
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
