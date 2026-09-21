import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  getSession,
  login,
  logout,
  register,
  type AuthUser,
} from './auth-client';

interface SignUpInput {
  displayName: string;
  email: string;
  password: string;
}

interface AuthContextValue {
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
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
      isLoading,
      signIn: async (email, password) => {
        setUser(await login(email, password));
      },
      signOut: async () => {
        try {
          await logout();
        } finally {
          setUser(null);
        }
      },
      signUp: async (input) => {
        const result = await register(input);
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
