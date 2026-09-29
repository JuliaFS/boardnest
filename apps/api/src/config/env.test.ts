import { describe, expect, it } from 'vitest';

import { parseEnvironment } from './env.js';

const required = {
  API_URL: 'http://localhost:4000',
  CORS_ORIGIN: 'http://localhost:5173',
  GUEST_RATE_LIMIT_SECRET: 'x'.repeat(32),
  REDIS_URL: 'redis://localhost:6379',
  SUPABASE_PUBLISHABLE_KEY: 'test-key',
  SUPABASE_URL: 'https://example.supabase.co',
};

describe('API environment', () => {
  it('parses required values and defaults', () => {
    expect(parseEnvironment(required)).toEqual({
      ...required,
      COOKIE_SAME_SITE: 'lax',
      NODE_ENV: 'development',
      PORT: 4000,
      TRUST_PROXY_HOPS: 0,
    });
  });

  it('rejects an invalid port', () => {
    expect(() => parseEnvironment({ ...required, PORT: '70000' })).toThrow(
      'Invalid API environment configuration',
    );
  });

  it('only allows cross-site cookies in production', () => {
    expect(() =>
      parseEnvironment({ ...required, COOKIE_SAME_SITE: 'none' }),
    ).toThrow('COOKIE_SAME_SITE=none requires NODE_ENV=production');
  });
});
