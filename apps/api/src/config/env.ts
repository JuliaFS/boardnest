import { config as loadDotEnv } from 'dotenv';
import { z } from 'zod';

const environmentSchema = z.object({
  API_URL: z.url(),
  CORS_ORIGIN: z.url(),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_URL: z.url(),
});

export type ApiEnvironment = z.infer<typeof environmentSchema>;

export function loadEnvironmentFile(): void {
  loadDotEnv({
    path: new URL('../../../../.env', import.meta.url),
    quiet: true,
  });
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
