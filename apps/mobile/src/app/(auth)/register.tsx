import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authStyles } from '@/features/auth/auth-ui';
import { useMobileAuth } from '@/features/auth/mobile-auth';
import { TurnstileChallenge } from '@/features/auth/TurnstileChallenge';
import { mobileEnvironment } from '@/lib/environment';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useMobileAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const captchaRequired = mobileEnvironment.turnstileSiteKey !== null;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    setStatus(null);
    try {
      const confirmationRequired = await signUp({
        captchaToken: captchaToken ?? undefined,
        displayName: displayName.trim(),
        email: email.trim(),
        password,
      });
      if (confirmationRequired) {
        setStatus(
          'Check your email and open the confirmation link on this device.',
        );
        setSubmitting(false);
      } else {
        router.replace('/(tabs)/dashboard');
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Registration failed.',
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
          <Text style={authStyles.title}>Create account</Text>
          <Text style={authStyles.description}>
            Your account works in both Boardnest web and mobile.
          </Text>
        </View>
        <View style={authStyles.card}>
          <AuthInput
            label="Display name"
            onChangeText={setDisplayName}
            value={displayName}
          />
          <AuthInput
            label="Email"
            onChangeText={setEmail}
            value={email}
            email
          />
          <AuthInput
            label="Password"
            onChangeText={setPassword}
            value={password}
            password
          />
          <TurnstileChallenge onToken={setCaptchaToken} />
          {error ? (
            <Text
              accessibilityLiveRegion="assertive"
              accessibilityRole="alert"
              style={authStyles.error}
            >
              {error}
            </Text>
          ) : null}
          {status ? (
            <Text accessibilityLiveRegion="polite" style={authStyles.status}>
              {status}
            </Text>
          ) : null}
          <Pressable
            disabled={
              submitting ||
              displayName.trim().length < 2 ||
              !email.trim() ||
              password.length < 8 ||
              (captchaRequired && !captchaToken)
            }
            onPress={() => void handleSubmit()}
            style={({ pressed }) => [
              authStyles.button,
              (pressed || submitting) && authStyles.buttonDisabled,
            ]}
          >
            <Text style={authStyles.buttonText}>
              {submitting ? 'Creating…' : 'Create account'}
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

function AuthInput({
  email,
  label,
  onChangeText,
  password,
  value,
}: {
  email?: boolean;
  label: string;
  onChangeText: (value: string) => void;
  password?: boolean;
  value: string;
}) {
  return (
    <View style={authStyles.field}>
      <Text style={authStyles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize={email || password ? 'none' : 'words'}
        autoComplete={email ? 'email' : password ? 'new-password' : 'name'}
        keyboardType={email ? 'email-address' : 'default'}
        onChangeText={onChangeText}
        secureTextEntry={password}
        style={authStyles.input}
        value={value}
      />
    </View>
  );
}
