import { generateKeyPairSync } from 'node:crypto';

import { createLocalJWKSet, exportJWK, SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';

import { createAccessTokenVerifier, readBearerToken } from './access-token.js';

const issuer = 'https://example.supabase.co/auth/v1';

async function createToken(role = 'authenticated') {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const publicJwk = await exportJWK(publicKey);
  publicJwk.alg = 'EdDSA';
  publicJwk.kid = 'test-key';

  const token = await new SignJWT({
    email: 'person@example.com',
    role,
  })
    .setProtectedHeader({ alg: 'EdDSA', kid: 'test-key' })
    .setSubject('4ac60f36-9f7a-419f-b447-d8f9d2bc7cd8')
    .setAudience('authenticated')
    .setIssuer(issuer)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);

  return {
    token,
    verifier: createAccessTokenVerifier({
      issuer,
      key: createLocalJWKSet({ keys: [publicJwk] }),
    }),
  };
}

describe('access token verification', () => {
  it('verifies a signed Supabase-shaped access token', async () => {
    const { token, verifier } = await createToken();

    await expect(verifier(token)).resolves.toEqual({
      email: 'person@example.com',
      id: '4ac60f36-9f7a-419f-b447-d8f9d2bc7cd8',
      role: 'authenticated',
    });
  });

  it('rejects a token without the authenticated role', async () => {
    const { token, verifier } = await createToken('anon');
    await expect(verifier(token)).rejects.toBeDefined();
  });
});

describe('bearer token parsing', () => {
  it('accepts a case-insensitive Bearer scheme', () => {
    expect(readBearerToken('bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('rejects malformed authorization headers', () => {
    expect(readBearerToken('Basic credentials')).toBeNull();
    expect(readBearerToken(undefined)).toBeNull();
  });
});
