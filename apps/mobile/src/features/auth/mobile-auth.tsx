import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { AppState, type AppStateStatus } from 'react-native';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { mobileApolloClient } from '@/lib/apollo';
import { mobileEnvironment } from '@/lib/environment';
import { mobileSupabase } from '@/lib/supabase';

export const AUTH_CALLBACK_URL = Linking.createURL('auth/callback');
export const PASSWORD_RESET_URL = Linking.createURL('auth/reset-password');

type SignUpInput = {
  captchaToken?: string;
  displayName: string;
  email: string;
  password: string;
};

type MobileAuthContextValue = {
  completeCodeExchange: (code: string) => Promise<void>;
  isLoading: boolean;
  requestPasswordReset: (email: string, captchaToken?: string) => Promise<void>;
  session: Session | null;
  signIn: (
    email: string,
    password: string,
    captchaToken?: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (input: SignUpInput) => Promise<boolean>;
  updatePassword: (password: string) => Promise<void>;
  user: User | null;
};

const MobileAuthContext = createContext<MobileAuthContextValue | null>(null);

export function MobileAuthProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void mobileSupabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    const { data } = mobileSupabase.auth.onAuthStateChange((_event, next) => {
      if (active) {
        setSession(next);
        setIsLoading(false);
      }
    });

    function handleAppState(nextState: AppStateStatus) {
      if (nextState === 'active') void mobileSupabase.auth.startAutoRefresh();
      else void mobileSupabase.auth.stopAutoRefresh();
    }

    const appStateSubscription = AppState.addEventListener(
      'change',
      handleAppState,
    );
    void mobileSupabase.auth.startAutoRefresh();

    return () => {
      active = false;
      appStateSubscription.remove();
      data.subscription.unsubscribe();
      void mobileSupabase.auth.stopAutoRefresh();
    };
  }, []);

  const value = useMemo<MobileAuthContextValue>(
    () => ({
      completeCodeExchange: async (code) => {
        const { error } =
          await mobileSupabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        await mobileApolloClient.clearStore();
      },
      isLoading,
      requestPasswordReset: async (email, captchaToken) => {
        const { error } = await mobileSupabase.auth.resetPasswordForEmail(
          email,
          {
            ...(captchaToken ? { captchaToken } : {}),
            redirectTo: PASSWORD_RESET_URL,
          },
        );
        if (error) throw error;
      },
      session,
      signIn: async (email, password, captchaToken) => {
        ensureMobileAuthConfigured();
        const { error } = await mobileSupabase.auth.signInWithPassword({
          email,
          options: captchaToken ? { captchaToken } : undefined,
          password,
        });
        if (error) throw error;
        await mobileApolloClient.clearStore();
      },
      signOut: async () => {
        try {
          await mobileSupabase.auth.signOut({ scope: 'local' });
        } finally {
          await mobileApolloClient.clearStore();
          setSession(null);
          router.replace('/(auth)/login');
        }
      },
      signUp: async ({ captchaToken, displayName, email, password }) => {
        ensureMobileAuthConfigured();
        const { data, error } = await mobileSupabase.auth.signUp({
          email,
          options: {
            ...(captchaToken ? { captchaToken } : {}),
            data: { display_name: displayName },
            emailRedirectTo: AUTH_CALLBACK_URL,
          },
          password,
        });
        if (error) throw error;
        await mobileApolloClient.clearStore();
        return data.session === null;
      },
      updatePassword: async (password) => {
        const { error } = await mobileSupabase.auth.updateUser({ password });
        if (error) throw error;
      },
      user: session?.user ?? null,
    }),
    [isLoading, router, session],
  );

  return <MobileAuthContext value={value}>{children}</MobileAuthContext>;
}

export function useMobileAuth(): MobileAuthContextValue {
  const context = useContext(MobileAuthContext);
  if (!context) {
    throw new Error('useMobileAuth must be used inside MobileAuthProvider.');
  }
  return context;
}

function ensureMobileAuthConfigured(): void {
  if (!mobileEnvironment.hasSupabaseConfiguration) {
    throw new Error('Configure the public Supabase mobile environment values.');
  }
}
