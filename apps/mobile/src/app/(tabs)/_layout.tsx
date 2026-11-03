import { MobileUnreadNotificationCountDocument } from '@boardnest/graphql-types';
import { useQuery } from '@apollo/client/react';
import { Tabs } from 'expo-router';

import { unreadBadgeLabel } from '@/features/notifications/notification-model';
import { useMobileLifecycle } from '@/lib/mobile-lifecycle';
import { theme } from '@/theme';

export default function TabsLayout() {
  const { appState, isOnline } = useMobileLifecycle();
  const unread = useQuery(MobileUnreadNotificationCountDocument, {
    fetchPolicy: 'cache-and-network',
    pollInterval: isOnline && appState === 'active' ? 60_000 : 0,
  });
  const unreadCount = unread.data?.unreadNotificationCount ?? 0;
  const badge = unreadBadgeLabel(unreadCount);

  return (
    <Tabs
      screenOptions={{
        headerBackButtonDisplayMode: 'minimal',
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.text,
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          minHeight: 64,
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          paddingBottom: theme.spacing.sm,
          paddingTop: theme.spacing.sm,
        },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          tabBarAccessibilityLabel: 'Dashboard tab',
          title: 'Dashboard',
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          tabBarAccessibilityLabel: 'Projects tab',
          title: 'Projects',
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          tabBarAccessibilityLabel:
            unreadCount > 0
              ? `Notifications tab, ${unreadCount} unread`
              : 'Notifications tab',
          tabBarBadge: badge,
          tabBarBadgeStyle: {
            backgroundColor: theme.colors.danger,
            color: theme.colors.primaryContrast,
          },
          title: 'Notifications',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarAccessibilityLabel: 'Settings tab',
          title: 'Settings',
        }}
      />
    </Tabs>
  );
}
