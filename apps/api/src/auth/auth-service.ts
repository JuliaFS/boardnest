import {
  createClient,
  type Session,
  type SupportedStorage,
  type User,
} from '@supabase/supabase-js';
import { z } from 'zod';

const claimsSchema = z.object({
  email: z.email().optional(),
  role: z.literal('authenticated'),
  sub: z.uuid(),
  user_metadata: z.record(z.string(), z.unknown()).optional(),
});

export interface PublicAuthUser {
  displayName: string | null;
  email: string | null;
  id: string;
  role: 'authenticated';
}

export interface AuthSessionResult {
  session: Session;
  user: PublicAuthUser;
}

export interface RegisterInput {
  displayName: string;
  email: string;
  password: string;
  storage: SupportedStorage;
}

export interface CompleteConfirmationInput {
  code: string;
  flowId?: string;
  storage: SupportedStorage;
}

export interface AuthService {
  completeConfirmation: (
    input: CompleteConfirmationInput,
  ) => Promise<AuthSessionResult>;
  login: (email: string, password: string) => Promise<AuthSessionResult>;
  refresh: (refreshToken: string) => Promise<AuthSessionResult>;
  register: (input: RegisterInput) => Promise<{
    confirmationRequired: boolean;
    result: AuthSessionResult | null;
  }>;
  signOut: (accessToken: string, refreshToken: string) => Promise<void>;
  verify: (accessToken: string) => Promise<PublicAuthUser>;
}

interface SupabaseAuthServiceOptions {
  callbackUrl: string;
  publishableKey: string;
  supabaseUrl: string;
}

export function createSupabaseAuthService({
  callbackUrl,
  publishableKey,
  supabaseUrl,
}: SupabaseAuthServiceOptions): AuthService {
  const pendingRefreshes = new Map<string, Promise<AuthSessionResult>>();

  function createAuthClient(storage?: SupportedStorage) {
    return createClient(supabaseUrl, publishableKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: 'pkce',
        persistSession: false,
        ...(storage ? { storage } : {}),
      },
    });
  }

  return {
    async completeConfirmation({ code, flowId, storage }) {
      const client = createAuthClient(storage);
      const { data, error } = await client.auth.exchangeCodeForSession(
        code,
        flowId ? { flowId } : undefined,
      );
      if (error) throw error;
      return mapSession(data.session, data.user);
    },

    async login(email, password) {
      const client = createAuthClient();
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return mapSession(data.session, data.user);
    },

    async refresh(refreshToken) {
      const pending = pendingRefreshes.get(refreshToken);
      if (pending) return pending;

      const refresh = (async () => {
        const client = createAuthClient();
        const { data, error } = await client.auth.refreshSession({
          refresh_token: refreshToken,
        });
        if (error) throw error;
        return mapSession(data.session, data.user);
      })();
      pendingRefreshes.set(refreshToken, refresh);

      try {
        return await refresh;
      } finally {
        pendingRefreshes.delete(refreshToken);
      }
    },

    async register({ displayName, email, password, storage }) {
      const client = createAuthClient(storage);
      const { data, error } = await client.auth.signUp({
        email,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: callbackUrl,
        },
        password,
      });
      if (error) throw error;

      return {
        confirmationRequired: data.session === null,
        result:
          data.session && data.user
            ? mapSession(data.session, data.user)
            : null,
      };
    },

    async signOut(accessToken, refreshToken) {
      const client = createAuthClient();
      const { error } = await client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (!error) await client.auth.signOut({ scope: 'local' });
    },

    async verify(accessToken) {
      const client = createAuthClient();
      const { data, error } = await client.auth.getClaims(accessToken);
      if (error) throw error;
      const claims = claimsSchema.parse(data?.claims);

      return {
        displayName: readDisplayName(claims.user_metadata),
        email: claims.email ?? null,
        id: claims.sub,
        role: claims.role,
      };
    },
  };
}

function mapSession(
  session: Session | null,
  user: User | null,
): AuthSessionResult {
  if (!session || !user)
    throw new Error('Supabase returned an invalid session.');

  return {
    session,
    user: {
      displayName: readDisplayName(user.user_metadata),
      email: user.email ?? null,
      id: user.id,
      role: 'authenticated',
    },
  };
}

function readDisplayName(
  metadata: Record<string, unknown> | undefined,
): string | null {
  const displayName = metadata?.display_name;
  return typeof displayName === 'string' ? displayName : null;
}
