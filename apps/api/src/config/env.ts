import { config as loadDotEnv } from 'dotenv';
import { z } from 'zod';

const environmentSchema = z
  .object({
    API_URL: z.url(),
    COOKIE_SAME_SITE: z.enum(['lax', 'none']).default('lax'),
    CORS_ORIGIN: z.url(),
    EMAIL_PROVIDER: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.enum(['resend', 'smtp']).optional(),
    ),
    GUEST_RATE_LIMIT_SECRET: z.string().min(32),
    EMAIL_DELIVERY_WORKER_BATCH_SIZE: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(25),
    EMAIL_DELIVERY_WORKER_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    EMAIL_DELIVERY_WORKER_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(5_000)
      .max(300_000)
      .default(15_000),
    INVITATION_EMAIL_FROM: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().trim().min(3).max(320).optional(),
    ),
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    REDIS_URL: z.url(),
    RESEND_API_KEY: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().trim().startsWith('re_').min(6).optional(),
    ),
    SMTP_HOST: optionalNonEmptyString(),
    SMTP_PASSWORD: optionalNonEmptyString(),
    SMTP_PORT: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.coerce.number().int().min(1).max(65_535).optional(),
    ),
    SMTP_SECURE: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z
        .enum(['true', 'false'])
        .transform((value) => value === 'true')
        .optional(),
    ),
    SMTP_USER: optionalNonEmptyString(),
    REMINDER_SCHEDULER_BATCH_SIZE: z.coerce
      .number()
      .int()
      .min(1)
      .max(500)
      .default(100),
    REMINDER_SCHEDULER_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    REMINDER_SCHEDULER_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(5_000)
      .max(300_000)
      .default(30_000),
    SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z
        .string()
        .refine(isSupabaseServerKey, {
          message:
            'Use a Supabase sb_secret_ key or legacy service_role JWT, not the example placeholder.',
        })
        .optional(),
    ),
    SUPABASE_URL: z.url(),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  })
  .superRefine((environment, context) => {
    const emailProvider =
      environment.EMAIL_PROVIDER ??
      (environment.RESEND_API_KEY ? 'resend' : undefined);
    const hasSmtpConfiguration = [
      environment.SMTP_HOST,
      environment.SMTP_PASSWORD,
      environment.SMTP_PORT,
      environment.SMTP_SECURE,
      environment.SMTP_USER,
    ].some((value) => value !== undefined);
    if (
      !emailProvider &&
      (environment.INVITATION_EMAIL_FROM || hasSmtpConfiguration)
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'EMAIL_PROVIDER is required when invitation email settings are configured.',
        path: ['EMAIL_PROVIDER'],
      });
    }
    if (emailProvider === 'resend' && !environment.RESEND_API_KEY) {
      context.addIssue({
        code: 'custom',
        message: 'RESEND_API_KEY is required when EMAIL_PROVIDER=resend.',
        path: ['RESEND_API_KEY'],
      });
    }
    if (emailProvider === 'resend' && !environment.INVITATION_EMAIL_FROM) {
      context.addIssue({
        code: 'custom',
        message:
          'INVITATION_EMAIL_FROM is required when EMAIL_PROVIDER=resend.',
        path: ['INVITATION_EMAIL_FROM'],
      });
    }
    if (emailProvider === 'smtp') {
      const requiredSmtpValues = [
        ['INVITATION_EMAIL_FROM', environment.INVITATION_EMAIL_FROM],
        ['SMTP_HOST', environment.SMTP_HOST],
        ['SMTP_PASSWORD', environment.SMTP_PASSWORD],
        ['SMTP_PORT', environment.SMTP_PORT],
        ['SMTP_SECURE', environment.SMTP_SECURE],
        ['SMTP_USER', environment.SMTP_USER],
      ] as const;
      for (const [name, value] of requiredSmtpValues) {
        if (value === undefined) {
          context.addIssue({
            code: 'custom',
            message: `${name} is required when EMAIL_PROVIDER=smtp.`,
            path: [name],
          });
        }
      }
    }
    if (
      environment.COOKIE_SAME_SITE === 'none' &&
      environment.NODE_ENV !== 'production'
    ) {
      context.addIssue({
        code: 'custom',
        message: 'COOKIE_SAME_SITE=none requires NODE_ENV=production.',
        path: ['COOKIE_SAME_SITE'],
      });
    }
    if (
      environment.REMINDER_SCHEDULER_ENABLED &&
      !environment.SUPABASE_SERVICE_ROLE_KEY
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'SUPABASE_SERVICE_ROLE_KEY is required when the reminder scheduler is enabled.',
        path: ['SUPABASE_SERVICE_ROLE_KEY'],
      });
    }
    if (
      environment.EMAIL_DELIVERY_WORKER_ENABLED &&
      !environment.SUPABASE_SERVICE_ROLE_KEY
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'SUPABASE_SERVICE_ROLE_KEY is required when the email delivery worker is enabled.',
        path: ['SUPABASE_SERVICE_ROLE_KEY'],
      });
    }
    if (environment.EMAIL_DELIVERY_WORKER_ENABLED && emailProvider !== 'smtp') {
      context.addIssue({
        code: 'custom',
        message:
          'EMAIL_PROVIDER=smtp is required when the email delivery worker is enabled.',
        path: ['EMAIL_PROVIDER'],
      });
    }
  });

function optionalNonEmptyString() {
  return z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().trim().min(1).optional(),
  );
}

export type ApiEnvironment = z.infer<typeof environmentSchema>;

export function loadEnvironmentFile(): void {
  loadDotEnv({
    path: new URL('../../../../.env', import.meta.url),
    quiet: true,
  });
}

function isSupabaseServerKey(value: string): boolean {
  if (value.startsWith('sb_secret_')) return value.length > 20;

  const payload = value.split('.')[1];
  if (!payload) return false;

  try {
    const claims = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as { role?: unknown };
    return claims.role === 'service_role';
  } catch {
    return false;
  }
}

export function parseEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): ApiEnvironment {
  const result = environmentSchema.safeParse(environment);

  if (!result.success) {
    const details = z.prettifyError(result.error);
    throw new Error(`Invalid API environment configuration:\n${details}`);
  }

  return result.data;
}
