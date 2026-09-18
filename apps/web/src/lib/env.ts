import { z } from 'zod';

const publicEnvironmentSchema = z.object({
  VITE_API_URL: z.url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  VITE_SUPABASE_URL: z.url(),
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

export const publicEnvironment = parsePublicEnvironment(import.meta.env);
