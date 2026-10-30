import {
  DarkTheme,
  Redirect,
  Stack,
  ThemeProvider,
  useSegments,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ApolloProvider } from '@apollo/client/react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { MobileAuthProvider, useMobileAuth } from '@/features/auth/mobile-auth';
import { mobileApolloClient } from '@/lib/apollo';
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
          <SessionGate />
        </ThemeProvider>
      </MobileAuthProvider>
    </ApolloProvider>
  );
}

function SessionGate() {
  const segments = useSegments();
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
    return <Redirect href="/(auth)/login" />;
  }

  if (session && rootSegment === '(auth)') {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
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
