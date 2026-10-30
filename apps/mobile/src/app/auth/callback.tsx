import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useMobileAuth } from '@/features/auth/mobile-auth';
import { theme } from '@/theme';

export default function AuthCallbackScreen() {
  const { code } = useLocalSearchParams<{ code?: string | string[] }>();
  const { completeCodeExchange } = useMobileAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const confirmationCode = Array.isArray(code) ? code[0] : code;
    if (!confirmationCode) {
      setError('The confirmation link is incomplete or expired.');
      return;
    }

    void completeCodeExchange(confirmationCode)
      .then(() => router.replace('/(tabs)/dashboard'))
      .catch((caught: unknown) =>
        setError(
          caught instanceof Error ? caught.message : 'Confirmation failed.',
        ),
      );
  }, [code, completeCodeExchange, router]);

  return (
    <View style={styles.page}>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <>
          <ActivityIndicator color={theme.colors.primary} size="large" />
          <Text style={styles.text}>Confirming your account…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  error: {
    color: theme.colors.danger,
    fontSize: 16,
    textAlign: 'center',
  },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
  },
  text: {
    color: theme.colors.text,
    fontSize: 16,
  },
});
