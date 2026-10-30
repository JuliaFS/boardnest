const DEFAULT_GRAPHQL_URL = 'http://localhost:4000/graphql';

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

const configuredGraphqlUrl = readOptionalString(process.env.EXPO_PUBLIC_GRAPHQL_URL);

export const mobileEnvironment = {
  graphqlUrl: configuredGraphqlUrl ?? DEFAULT_GRAPHQL_URL,
  hasConfiguredGraphqlUrl: configuredGraphqlUrl !== undefined,
} as const;
