import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import { SetContextLink } from '@apollo/client/link/context';

import { mobileEnvironment } from './environment';
import { mobileSupabase } from './supabase';

export function createMobileApolloClient(
  uri: string = mobileEnvironment.graphqlUrl,
  fetchImplementation: typeof fetch = fetch,
) {
  const authenticationLink = new SetContextLink(async (previousContext) => {
    const { data } = await mobileSupabase.auth.getSession();
    const accessToken = data.session?.access_token;
    const previousHeaders: unknown = previousContext.headers;

    return {
      headers: {
        ...readStringHeaders(previousHeaders),
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
    };
  });

  return new ApolloClient({
    cache: new InMemoryCache(),
    link: authenticationLink.concat(
      new HttpLink({
        credentials: 'omit',
        fetch: fetchImplementation,
        uri,
      }),
    ),
  });
}

function readStringHeaders(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null) return {};

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

export const mobileApolloClient = createMobileApolloClient();
