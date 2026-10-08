import { config as loadDotEnv } from 'dotenv';
import { z } from 'zod';

const environmentSchema = z
  .object({
    API_URL: z.url(),
    COOKIE_SAME_SITE: z.enum(['lax', 'none']).default('lax'),
    CORS_ORIGIN: z.url(),
    GUEST_RATE_LIMIT_SECRET: z.string().min(32),
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    REDIS_URL: z.url(),
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
  });

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
