/* eslint-disable @typescript-eslint/unbound-method -- Supabase and Apollo methods are Jest mocks in this test module. */
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text, View } from 'react-native';

import { mobileApolloClient, reconnectMobileRealtime } from '@/lib/apollo';
import { mobileSupabase } from '@/lib/supabase';

import { MobileAuthProvider, useMobileAuth } from './mobile-auth';

const mockReplace = jest.fn();

jest.mock('expo-linking', () => ({
  createURL: (path: string) => `boardnest://${path}`,
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@/lib/apollo', () => ({
  mobileApolloClient: { clearStore: jest.fn() },
  reconnectMobileRealtime: jest.fn(),
}));

jest.mock('@/lib/environment', () => ({
  mobileEnvironment: { hasSupabaseConfiguration: true },
}));

jest.mock('@/lib/supabase', () => ({
  mobileSupabase: {
    auth: {
      exchangeCodeForSession: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      signUp: jest.fn(),
      updateUser: jest.fn(),
    },
  },
}));

jest.mock('@/features/notifications/push-notifications', () => ({
  disablePushNotifications: jest.fn().mockResolvedValue(undefined),
}));

function session(email: string) {
  return {
    access_token: `${email}-access-token`,
    expires_in: 3600,
    refresh_token: `${email}-refresh-token`,
    token_type: 'bearer',
    user: { email, id: email },
  };
}

function AuthProbe() {
  const auth = useMobileAuth();
  return (
    <View>
      <Text>
        {auth.isLoading ? 'restoring' : (auth.user?.email ?? 'signed out')}
      </Text>
      <Text>{auth.session?.access_token ?? 'no token'}</Text>
      <Text accessibilityRole="button" onPress={() => void auth.signOut()}>
        Sign out
      </Text>
    </View>
  );
}

describe('MobileAuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(mobileApolloClient.clearStore).mockResolvedValue([]);
  });

  test('restores a session and applies a refreshed token', async () => {
    const restored = session('restored@example.com');
    const refreshed = session('refreshed@example.com');
    let authListener: ((event: string, value: unknown) => void) | undefined;
    jest.mocked(mobileSupabase.auth.getSession).mockResolvedValue({
      data: { session: restored },
      error: null,
    } as never);
    jest
      .mocked(mobileSupabase.auth.onAuthStateChange)
      .mockImplementation((listener) => {
        authListener = listener as typeof authListener;
        return {
          data: { subscription: { id: 'test', unsubscribe: jest.fn() } },
        } as never;
      });

    const screen = await render(
      <MobileAuthProvider>
        <AuthProbe />
      </MobileAuthProvider>,
    );
    expect(await screen.findByText('restored@example.com')).toBeTruthy();

    await act(() => authListener?.('TOKEN_REFRESHED', refreshed));

    expect(screen.getByText('refreshed@example.com')).toBeTruthy();
    expect(screen.getByText('refreshed@example.com-access-token')).toBeTruthy();
    expect(reconnectMobileRealtime).toHaveBeenCalledTimes(1);
  });

  test('clears private cache and returns to login on logout', async () => {
    jest.mocked(mobileSupabase.auth.getSession).mockResolvedValue({
      data: { session: session('user@example.com') },
      error: null,
    } as never);
    jest.mocked(mobileSupabase.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: { id: 'test', unsubscribe: jest.fn() } },
    } as never);
    jest.mocked(mobileSupabase.auth.signOut).mockResolvedValue({ error: null });

    const screen = await render(
      <MobileAuthProvider>
        <AuthProbe />
      </MobileAuthProvider>,
    );
    expect(await screen.findByText('user@example.com')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => {
      expect(mobileApolloClient.clearStore).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
    });
  });
});
