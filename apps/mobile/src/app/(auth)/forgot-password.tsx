import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authStyles } from '@/features/auth/auth-ui';
import { useMobileAuth } from '@/features/auth/mobile-auth';
import { TurnstileChallenge } from '@/features/auth/TurnstileChallenge';
import { mobileEnvironment } from '@/lib/environment';

export default function ForgotPasswordScreen() {
  const { requestPasswordReset } = useMobileAuth();
  const [email, setEmail] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim(), captchaToken ?? undefined);
      setMessage('If the account exists, a reset link has been sent.');
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'The reset request failed.',
      );
    } finally {
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
          <Text style={authStyles.title}>Reset password</Text>
          <Text style={authStyles.description}>
            We will email a secure link that opens Boardnest on this device.
          </Text>
        </View>
        <View style={authStyles.card}>
          <View style={authStyles.field}>
            <Text style={authStyles.label}>Email</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              style={authStyles.input}
              value={email}
            />
          </View>
          <TurnstileChallenge onToken={setCaptchaToken} />
          {error ? <Text style={authStyles.error}>{error}</Text> : null}
          {message ? <Text style={authStyles.status}>{message}</Text> : null}
          <Pressable
            disabled={
              submitting ||
              !email.trim() ||
              (mobileEnvironment.turnstileSiteKey !== null && !captchaToken)
            }
            onPress={() => void handleSubmit()}
            style={({ pressed }) => [
              authStyles.button,
              (pressed || submitting) && authStyles.buttonDisabled,
            ]}
          >
            <Text style={authStyles.buttonText}>
              {submitting ? 'Sending…' : 'Send reset link'}
            </Text>
          </Pressable>
          <Link href="/(auth)/login" style={authStyles.link}>
            Back to sign in
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
