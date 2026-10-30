import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';

import { mobileEnvironment } from './environment';

export function createMobileApolloClient(
  uri: string = mobileEnvironment.graphqlUrl,
  fetchImplementation: typeof fetch = fetch,
) {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({
      credentials: 'omit',
      fetch: fetchImplementation,
      uri,
    }),
  });
}

export const mobileApolloClient = createMobileApolloClient();
