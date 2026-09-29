import { z } from 'zod';

const publicEnvironmentSchema = z.object({
  VITE_API_URL: z.url(),
  VITE_GRAPHQL_URL: z.url(),
  VITE_TURNSTILE_SITE_KEY: z.string().min(1),
  VITE_WS_URL: z.url(),
});

export type PublicEnvironment = z.infer<typeof publicEnvironmentSchema>;

export function parsePublicEnvironment(
  environment: Record<string, unknown>,
): PublicEnvironment {
  const result = publicEnvironmentSchema.safeParse(environment);

  if (!result.success) {
    throw new Error(
      'Missing or invalid public environment variables. Check the root .env file.',
    );
  }

  return result.data;
}

export const publicEnvironment = parsePublicEnvironment({
  VITE_API_URL: import.meta.env.VITE_API_URL,
  VITE_GRAPHQL_URL: import.meta.env.VITE_GRAPHQL_URL,
  VITE_TURNSTILE_SITE_KEY: import.meta.env.VITE_TURNSTILE_SITE_KEY,
  VITE_WS_URL: import.meta.env.VITE_WS_URL,
});
