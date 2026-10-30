const DEFAULT_GRAPHQL_URL = 'http://localhost:4000/graphql';

function readGraphqlUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_GRAPHQL_URL?.trim();
  return configuredUrl || DEFAULT_GRAPHQL_URL;
}

export const mobileEnvironment = {
  graphqlUrl: readGraphqlUrl(),
  hasConfiguredGraphqlUrl: Boolean(process.env.EXPO_PUBLIC_GRAPHQL_URL?.trim()),
} as const;
