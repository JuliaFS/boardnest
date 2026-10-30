import { Tabs } from 'expo-router';

import { theme } from '@/theme';

export default function TabsLayout() {
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
          tabBarAccessibilityLabel: 'Notifications tab',
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
