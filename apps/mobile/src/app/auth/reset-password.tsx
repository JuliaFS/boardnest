import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authStyles } from '@/features/auth/auth-ui';
import { useMobileAuth } from '@/features/auth/mobile-auth';

export default function ResetPasswordScreen() {
  const { code } = useLocalSearchParams<{ code?: string | string[] }>();
  const { completeCodeExchange, session, updatePassword } = useMobileAuth();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [preparing, setPreparing] = useState(session === null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      setPreparing(false);
      return;
    }
    const resetCode = Array.isArray(code) ? code[0] : code;
    if (!resetCode) {
      setError('The reset link is incomplete or expired.');
      setPreparing(false);
      return;
    }
    void completeCodeExchange(resetCode)
      .catch((caught: unknown) =>
        setError(
          caught instanceof Error ? caught.message : 'The reset link failed.',
        ),
      )
      .finally(() => setPreparing(false));
  }, [code, completeCodeExchange, session]);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await updatePassword(password);
      router.replace('/(tabs)/dashboard');
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Password update failed.',
      );
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={authStyles.page}>
      <ScrollView
        contentContainerStyle={authStyles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View>
          <Text style={authStyles.title}>Choose a password</Text>
          <Text style={authStyles.description}>
            {preparing
              ? 'Validating the secure reset link…'
              : 'Use at least eight characters.'}
          </Text>
        </View>
        <View style={authStyles.card}>
          <View style={authStyles.field}>
            <Text style={authStyles.label}>New password</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="new-password"
              editable={!preparing}
              onChangeText={setPassword}
              secureTextEntry
              style={authStyles.input}
              value={password}
            />
          </View>
          {error ? <Text style={authStyles.error}>{error}</Text> : null}
          <Pressable
            disabled={preparing || submitting || password.length < 8 || !!error}
            onPress={() => void handleSubmit()}
            style={({ pressed }) => [
              authStyles.button,
              (pressed || preparing || submitting) && authStyles.buttonDisabled,
            ]}
          >
            <Text style={authStyles.buttonText}>
              {submitting ? 'Updating…' : 'Update password'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
