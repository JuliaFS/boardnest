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
      CUSTOM_NOTIFICATION_SCHEDULER_BATCH_SIZE: 100,
      CUSTOM_NOTIFICATION_SCHEDULER_ENABLED: false,
      CUSTOM_NOTIFICATION_SCHEDULER_INTERVAL_MS: 30_000,
      EMAIL_DELIVERY_WORKER_BATCH_SIZE: 25,
      EMAIL_DELIVERY_WORKER_ENABLED: false,
      EMAIL_DELIVERY_WORKER_INTERVAL_MS: 15_000,
      NODE_ENV: 'development',
      PORT: 4000,
      PUSH_NOTIFICATION_WORKER_BATCH_SIZE: 50,
      PUSH_NOTIFICATION_WORKER_ENABLED: false,
      PUSH_NOTIFICATION_WORKER_INTERVAL_MS: 15_000,
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

  it('requires a service role key only when the custom notification scheduler is enabled', () => {
    expect(() =>
      parseEnvironment({
        ...required,
        CUSTOM_NOTIFICATION_SCHEDULER_ENABLED: 'true',
      }),
    ).toThrow(
      'SUPABASE_SERVICE_ROLE_KEY is required when the custom notification scheduler is enabled',
    );

    expect(
      parseEnvironment({
        ...required,
        CUSTOM_NOTIFICATION_SCHEDULER_BATCH_SIZE: '50',
        CUSTOM_NOTIFICATION_SCHEDULER_ENABLED: 'true',
        CUSTOM_NOTIFICATION_SCHEDULER_INTERVAL_MS: '5000',
        SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_boardnest_server_only_test_value',
      }),
    ).toMatchObject({
      CUSTOM_NOTIFICATION_SCHEDULER_BATCH_SIZE: 50,
      CUSTOM_NOTIFICATION_SCHEDULER_ENABLED: true,
      CUSTOM_NOTIFICATION_SCHEDULER_INTERVAL_MS: 5_000,
    });
  });

  it('requires SMTP and a service role key when the email worker is enabled', () => {
    expect(() =>
      parseEnvironment({
        ...required,
        EMAIL_DELIVERY_WORKER_ENABLED: 'true',
      }),
    ).toThrow(
      'SUPABASE_SERVICE_ROLE_KEY is required when the email delivery worker is enabled',
    );

    expect(() =>
      parseEnvironment({
        ...required,
        EMAIL_DELIVERY_WORKER_ENABLED: 'true',
        INVITATION_EMAIL_FROM: 'Boardnest <notifications@example.com>',
        RESEND_API_KEY: 're_test',
        SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_boardnest_server_only_test_value',
      }),
    ).toThrow(
      'EMAIL_PROVIDER=smtp is required when the email delivery worker is enabled',
    );

    expect(
      parseEnvironment({
        ...required,
        EMAIL_DELIVERY_WORKER_BATCH_SIZE: '10',
        EMAIL_DELIVERY_WORKER_ENABLED: 'true',
        EMAIL_DELIVERY_WORKER_INTERVAL_MS: '5000',
        EMAIL_PROVIDER: 'smtp',
        INVITATION_EMAIL_FROM: 'Boardnest <boardnest@gmail.com>',
        SMTP_HOST: 'smtp.gmail.com',
        SMTP_PASSWORD: 'google-app-password',
        SMTP_PORT: '587',
        SMTP_SECURE: 'false',
        SMTP_USER: 'boardnest@gmail.com',
        SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_boardnest_server_only_test_value',
      }),
    ).toMatchObject({
      EMAIL_DELIVERY_WORKER_BATCH_SIZE: 10,
      EMAIL_DELIVERY_WORKER_ENABLED: true,
      EMAIL_DELIVERY_WORKER_INTERVAL_MS: 5_000,
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

  it('validates Resend invitation email settings', () => {
    expect(() =>
      parseEnvironment({ ...required, RESEND_API_KEY: 're_test' }),
    ).toThrow('INVITATION_EMAIL_FROM is required when EMAIL_PROVIDER=resend');

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

    expect(() =>
      parseEnvironment({
        ...required,
        EMAIL_PROVIDER: 'resend',
        INVITATION_EMAIL_FROM: 'Boardnest <invites@example.com>',
      }),
    ).toThrow('RESEND_API_KEY is required when EMAIL_PROVIDER=resend');
  });

  it('validates SMTP invitation email settings', () => {
    expect(() =>
      parseEnvironment({ ...required, SMTP_HOST: 'smtp.gmail.com' }),
    ).toThrow(
      'EMAIL_PROVIDER is required when invitation email settings are configured',
    );

    expect(() =>
      parseEnvironment({ ...required, EMAIL_PROVIDER: 'smtp' }),
    ).toThrow('SMTP_HOST is required when EMAIL_PROVIDER=smtp');

    expect(
      parseEnvironment({
        ...required,
        EMAIL_PROVIDER: 'smtp',
        INVITATION_EMAIL_FROM: 'Boardnest <boardnest@gmail.com>',
        SMTP_HOST: 'smtp.gmail.com',
        SMTP_PASSWORD: 'google-app-password',
        SMTP_PORT: '465',
        SMTP_SECURE: 'true',
        SMTP_USER: 'boardnest@gmail.com',
      }),
    ).toMatchObject({
      EMAIL_PROVIDER: 'smtp',
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PASSWORD: 'google-app-password',
      SMTP_PORT: 465,
      SMTP_SECURE: true,
      SMTP_USER: 'boardnest@gmail.com',
    });
  });
});
