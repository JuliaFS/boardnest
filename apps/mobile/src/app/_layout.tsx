import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ApolloProvider } from '@apollo/client/react';

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
      <ThemeProvider value={boardnestNavigationTheme}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </ThemeProvider>
    </ApolloProvider>
  );
}
