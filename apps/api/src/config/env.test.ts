import { describe, expect, it } from 'vitest';

import { parseEnvironment } from './env.js';

const required = {
  API_URL: 'http://localhost:4000',
  CORS_ORIGIN: 'http://localhost:5174',
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
      REMINDER_SCHEDULER_BATCH_SIZE: 100,
      REMINDER_SCHEDULER_ENABLED: false,
      REMINDER_SCHEDULER_INTERVAL_MS: 30_000,
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

  it('requires a service role key only when the reminder scheduler is enabled', () => {
    expect(() =>
      parseEnvironment({ ...required, REMINDER_SCHEDULER_ENABLED: 'true' }),
    ).toThrow(
      'SUPABASE_SERVICE_ROLE_KEY is required when the reminder scheduler is enabled',
    );

    expect(
      parseEnvironment({
        ...required,
        REMINDER_SCHEDULER_BATCH_SIZE: '50',
        REMINDER_SCHEDULER_ENABLED: 'true',
        REMINDER_SCHEDULER_INTERVAL_MS: '5000',
        SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_boardnest_server_only_test_value',
      }),
    ).toMatchObject({
      REMINDER_SCHEDULER_BATCH_SIZE: 50,
      REMINDER_SCHEDULER_ENABLED: true,
      REMINDER_SCHEDULER_INTERVAL_MS: 5_000,
      SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_boardnest_server_only_test_value',
    });
  });

  it('rejects a placeholder instead of failing later at request time', () => {
    expect(() =>
      parseEnvironment({
        ...required,
        SUPABASE_SERVICE_ROLE_KEY: 'your-server-only-service-role-key',
      }),
    ).toThrow('not the example placeholder');
  });

  it('requires invitation email settings as a pair', () => {
    expect(() =>
      parseEnvironment({ ...required, RESEND_API_KEY: 're_test' }),
    ).toThrow(
      'RESEND_API_KEY and INVITATION_EMAIL_FROM must be configured together',
    );

    expect(
      parseEnvironment({
        ...required,
        INVITATION_EMAIL_FROM: 'Boardnest <invites@example.com>',
        RESEND_API_KEY: 're_test',
      }),
    ).toMatchObject({
      INVITATION_EMAIL_FROM: 'Boardnest <invites@example.com>',
      RESEND_API_KEY: 're_test',
    });
  });
});
