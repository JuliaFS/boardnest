import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  type AuthChangeEvent,
  type Session,
  type SignInWithPasswordCredentials,
  type SignUpWithPasswordCredentials,
} from '@supabase/supabase-js';

import { supabase } from '../../lib/supabase';

interface AuthClient {
  onAuthStateChange: (
    callback: (event: AuthChangeEvent, session: Session | null) => void,
  ) => {
    data: { subscription: { unsubscribe: () => void } };
  };
  signInWithPassword: (credentials: SignInWithPasswordCredentials) => Promise<{
    error: Error | null;
  }>;
  signOut: () => Promise<{ error: Error | null }>;
  signUp: (credentials: SignUpWithPasswordCredentials) => Promise<{
    data: { session: Session | null };
    error: Error | null;
  }>;
}

interface AuthContextValue {
  isLoading: boolean;
  session: Session | null;
  signIn: (credentials: SignInWithPasswordCredentials) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (credentials: SignUpWithPasswordCredentials) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps extends PropsWithChildren {
  client?: AuthClient;
}

export function AuthProvider({
  children,
  client = supabase.auth,
}: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { data } = client.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => data.subscription.unsubscribe();
  }, [client]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      session,
      signIn: async (credentials) => {
        const { error } = await client.signInWithPassword(credentials);
        if (error) throw error;
      },
      signOut: async () => {
        const { error } = await client.signOut();
        if (error) throw error;
      },
      signUp: async (credentials) => {
        const { data, error } = await client.signUp(credentials);
        if (error) throw error;
        return data.session === null;
      },
    }),
    [client, isLoading, session],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
