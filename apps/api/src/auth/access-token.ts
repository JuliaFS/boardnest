import { jwtVerify, type JWTVerifyGetKey } from 'jose';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const claimsSchema = z.object({
  email: z.email().optional(),
  role: z.literal('authenticated'),
  sub: z.uuid(),
});

export interface AuthenticatedUser {
  email: string | null;
  id: string;
  role: 'authenticated';
}

export type VerifyAccessToken = (token: string) => Promise<AuthenticatedUser>;

interface AccessTokenVerifierOptions {
  issuer: string;
  key: JWTVerifyGetKey;
}

export function createAccessTokenVerifier({
  issuer,
  key,
}: AccessTokenVerifierOptions): VerifyAccessToken {
  return async (token) => {
    const { payload } = await jwtVerify(token, key, {
      audience: 'authenticated',
      issuer,
    });
    const claims = claimsSchema.parse(payload);

    return {
      email: claims.email ?? null,
      id: claims.sub,
      role: claims.role,
    };
  };
}

export function createSupabaseAccessTokenVerifier(
  supabaseUrl: string,
  publishableKey: string,
): VerifyAccessToken {
  const client = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  return async (token) => {
    const { data, error } = await client.auth.getClaims(token);

    if (error) throw error;

    const claims = claimsSchema.parse(data?.claims);
    return {
      email: claims.email ?? null,
      id: claims.sub,
      role: claims.role,
    };
  };
}

export function readBearerToken(
  authorizationHeader: string | undefined,
): string | null {
  if (!authorizationHeader) return null;

  const match = /^Bearer\s+(\S+)$/i.exec(authorizationHeader);
  return match?.[1] ?? null;
}
