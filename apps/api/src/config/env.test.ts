import { describe, expect, it } from 'vitest';

import { parseEnvironment } from './env.js';

describe('API environment', () => {
  it('parses required values and defaults', () => {
    expect(
      parseEnvironment({
        API_URL: 'http://localhost:4000',
        CORS_ORIGIN: 'http://localhost:5173',
        SUPABASE_PUBLISHABLE_KEY: 'test-key',
        SUPABASE_URL: 'https://example.supabase.co',
      }),
    ).toEqual({
      API_URL: 'http://localhost:4000',
      CORS_ORIGIN: 'http://localhost:5173',
      NODE_ENV: 'development',
      PORT: 4000,
      SUPABASE_PUBLISHABLE_KEY: 'test-key',
      SUPABASE_URL: 'https://example.supabase.co',
    });
  });

  it('rejects an invalid port', () => {
    expect(() =>
      parseEnvironment({
        API_URL: 'http://localhost:4000',
        CORS_ORIGIN: 'http://localhost:5173',
        PORT: '70000',
        SUPABASE_PUBLISHABLE_KEY: 'test-key',
        SUPABASE_URL: 'https://example.supabase.co',
      }),
    ).toThrow('Invalid API environment configuration');
  });
});
