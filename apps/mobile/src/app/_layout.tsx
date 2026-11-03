import {
  DarkTheme,
  Redirect,
  Stack,
  ThemeProvider,
  useGlobalSearchParams,
  usePathname,
  useSegments,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ApolloProvider } from '@apollo/client/react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { FeedbackProvider } from '@/components/ui';
import { MobileAuthProvider, useMobileAuth } from '@/features/auth/mobile-auth';
import { PushNotificationBridge } from '@/features/notifications/push-notifications';
import { mobileApolloClient } from '@/lib/apollo';
import { invitationRouteFromReturnTo, mobileRoutes } from '@/navigation/routes';
import { theme } from '@/theme';

const boardnestNavigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.colors.background,
    border: theme.colors.border,
    card: theme.colors.surface,
    primary: theme.colors.primary,
    text: theme.colors.text,
  },
};

export default function RootLayout() {
  return (
    <ApolloProvider client={mobileApolloClient}>
      <MobileAuthProvider>
        <ThemeProvider value={boardnestNavigationTheme}>
          <StatusBar style="light" />
          <FeedbackProvider>
            <PushNotificationBridge />
            <SessionGate />
          </FeedbackProvider>
        </ThemeProvider>
      </MobileAuthProvider>
    </ApolloProvider>
  );
}

function SessionGate() {
  const segments = useSegments();
  const pathname = usePathname();
  const { returnTo } = useGlobalSearchParams<{
    returnTo?: string | string[];
  }>();
  const { isLoading, session } = useMobileAuth();
  const rootSegment: string | undefined = segments[0];
  const isPublicAuthRoute = rootSegment === '(auth)' || rootSegment === 'auth';

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  if (!session && !isPublicAuthRoute) {
    const invitationRoute = invitationRouteFromReturnTo(pathname);
    return (
      <Redirect
        href={
          invitationRoute
            ? {
                pathname: '/(auth)/login',
                params: { returnTo: invitationRoute },
              }
            : '/(auth)/login'
        }
      />
    );
  }

  if (session && rootSegment === '(auth)') {
    const rawReturnTo = Array.isArray(returnTo) ? returnTo[0] : returnTo;
    return (
      <Redirect
        href={
          invitationRouteFromReturnTo(rawReturnTo) ?? mobileRoutes.dashboard
        }
      />
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="workspaces/[workspaceId]" />
      <Stack.Screen name="projects/[projectId]/index" />
      <Stack.Screen name="projects/[projectId]/board" />
      <Stack.Screen name="projects/[projectId]/tasks/[taskId]" />
      <Stack.Screen name="auth/callback" />
      <Stack.Screen name="auth/reset-password" />
      <Stack.Screen name="invite/[token]" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
});
