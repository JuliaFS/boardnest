import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authStyles } from '@/features/auth/auth-ui';
import { useMobileAuth } from '@/features/auth/mobile-auth';
import { TurnstileChallenge } from '@/features/auth/TurnstileChallenge';
import { mobileEnvironment } from '@/lib/environment';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useMobileAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const captchaRequired = mobileEnvironment.turnstileSiteKey !== null;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email.trim(), password, captchaToken ?? undefined);
      router.replace('/(tabs)/dashboard');
    } catch (caught) {
      setError(authErrorMessage(caught));
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
          <Text style={authStyles.title}>Sign in</Text>
          <Text style={authStyles.description}>
            Use the same Boardnest account as the web application.
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
          <View style={authStyles.field}>
            <Text style={authStyles.label}>Password</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="current-password"
              onChangeText={setPassword}
              secureTextEntry
              style={authStyles.input}
              value={password}
            />
          </View>
          <TurnstileChallenge onToken={setCaptchaToken} />
          {error ? <Text style={authStyles.error}>{error}</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={
              submitting ||
              !email.trim() ||
              !password ||
              (captchaRequired && !captchaToken)
            }
            onPress={() => void handleSubmit()}
            style={({ pressed }) => [
              authStyles.button,
              (pressed || submitting) && authStyles.buttonDisabled,
            ]}
          >
            <Text style={authStyles.buttonText}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Text>
          </Pressable>
          <View style={authStyles.actions}>
            <Link href="/(auth)/forgot-password" style={authStyles.link}>
              Forgot password?
            </Link>
            <Link href="/(auth)/register" style={authStyles.link}>
              Create an account
            </Link>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function authErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Authentication failed.';
}
