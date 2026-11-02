const DEFAULT_API_URL = 'http://localhost:4000';
const DEFAULT_GRAPHQL_URL = `${DEFAULT_API_URL}/graphql`;
const DEFAULT_SUPABASE_URL = 'https://example.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_mobile_configuration_required';

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

const configuredGraphqlUrl = readOptionalString(
  process.env.EXPO_PUBLIC_GRAPHQL_URL,
);
const configuredWebSocketUrl = readOptionalString(
  process.env.EXPO_PUBLIC_WS_URL,
);
const configuredApiUrl = readOptionalString(process.env.EXPO_PUBLIC_API_URL);
const configuredSupabaseUrl = readOptionalString(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
);
const configuredSupabaseKey = readOptionalString(
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

export const mobileEnvironment = {
  apiUrl: configuredApiUrl ?? DEFAULT_API_URL,
  graphqlUrl: configuredGraphqlUrl ?? DEFAULT_GRAPHQL_URL,
  hasConfiguredGraphqlUrl: configuredGraphqlUrl !== undefined,
  hasSupabaseConfiguration:
    configuredSupabaseUrl !== undefined && configuredSupabaseKey !== undefined,
  supabasePublishableKey: configuredSupabaseKey ?? DEFAULT_SUPABASE_KEY,
  supabaseUrl: configuredSupabaseUrl ?? DEFAULT_SUPABASE_URL,
  turnstileSiteKey:
    readOptionalString(process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY) ?? null,
  webUrl:
    readOptionalString(process.env.EXPO_PUBLIC_WEB_URL) ??
    'https://boardnest-web-omega.vercel.app',
  websocketUrl:
    configuredWebSocketUrl ??
    toWebSocketUrl(configuredGraphqlUrl ?? DEFAULT_GRAPHQL_URL),
} as const;

export function toWebSocketUrl(graphqlUrl: string): string {
  const url = new URL(graphqlUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}
