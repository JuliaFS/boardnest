import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text as MockText } from 'react-native';

import LoginScreen from './login';

const mockReplace = jest.fn();
const mockSignIn = jest.fn<
  Promise<void>,
  [email: string, password: string, captchaToken?: string]
>();

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => (
    <MockText>{children}</MockText>
  ),
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@/features/auth/mobile-auth', () => ({
  useMobileAuth: () => ({ signIn: mockSignIn }),
}));

jest.mock('@/features/auth/TurnstileChallenge', () => ({
  TurnstileChallenge: () => null,
}));

jest.mock('@/lib/environment', () => ({
  mobileEnvironment: { turnstileSiteKey: null },
}));

describe('LoginScreen', () => {
  test('submits accessible credentials and opens the dashboard', async () => {
    mockSignIn.mockResolvedValueOnce(undefined);
    const screen = await render(<LoginScreen />);
    const submit = screen.getByRole('button', { name: 'Sign in' });

    expect(submit.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.changeText(
      screen.getByLabelText('Email'),
      ' user@example.com ',
    );
    await fireEvent.changeText(
      screen.getByLabelText('Password'),
      'password123',
    );
    await fireEvent.press(submit);

    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith(
        'user@example.com',
        'password123',
        undefined,
      ),
    );
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/dashboard');
  });

  test('announces authentication errors without navigating', async () => {
    mockSignIn.mockRejectedValueOnce(new Error('Invalid credentials.'));
    const screen = await render(<LoginScreen />);
    await fireEvent.changeText(
      screen.getByLabelText('Email'),
      'user@example.com',
    );
    await fireEvent.changeText(
      screen.getByLabelText('Password'),
      'wrong-password',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    const alert = await screen.findByRole('alert');
    expect(alert.props.children).toBe('Invalid credentials.');
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
