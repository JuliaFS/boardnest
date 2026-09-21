import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';

import { publicEnvironment } from './env';

export function createApolloClient(fetchImplementation: typeof fetch = fetch) {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({
      credentials: 'include',
      fetch: fetchImplementation,
      uri: publicEnvironment.VITE_GRAPHQL_URL,
    }),
  });
}

export const apolloClient = createApolloClient();
