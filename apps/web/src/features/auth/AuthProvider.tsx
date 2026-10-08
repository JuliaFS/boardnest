import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  continueAsGuest,
  deleteAccount,
  type DeleteAccountInput,
  getSession,
  login,
  logout,
  register,
  type AuthUser,
} from './auth-client';
import { apolloClient } from '../../lib/apollo-client';

interface SignUpInput {
  captchaToken: string;
  displayName: string;
  email: string;
  password: string;
  returnTo?: string;
}

interface AuthContextValue {
  continueAsGuest: (captchaToken: string) => Promise<void>;
  deleteAccount: (input: DeleteAccountInput) => Promise<void>;
  isLoading: boolean;
  signIn: (
    email: string,
    password: string,
    captchaToken: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (input: SignUpInput) => Promise<boolean>;
  user: AuthUser | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void getSession()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      continueAsGuest: async (captchaToken) => {
        await apolloClient.clearStore();
        setUser(await continueAsGuest(captchaToken));
      },
      deleteAccount: async (input) => {
        await deleteAccount(input);
        await apolloClient.clearStore();
        setUser(null);
      },
      isLoading,
      signIn: async (email, password, captchaToken) => {
        await apolloClient.clearStore();
        setUser(await login(email, password, captchaToken));
      },
      signOut: async () => {
        try {
          await logout();
        } finally {
          await apolloClient.clearStore();
          setUser(null);
        }
      },
      signUp: async (input) => {
        const result = await register(input);
        await apolloClient.clearStore();
        setUser(result.user);
        return result.confirmationRequired;
      },
      user,
    }),
    [isLoading, user],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
