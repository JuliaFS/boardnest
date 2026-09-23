import { ApolloClient, HttpLink, InMemoryCache, split } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { Kind, OperationTypeNode } from 'graphql';
import { createClient } from 'graphql-ws';

import { publicEnvironment } from './env';

export function createApolloClient(fetchImplementation: typeof fetch = fetch) {
  const httpLink = new HttpLink({
    credentials: 'include',
    fetch: fetchImplementation,
    uri: publicEnvironment.VITE_GRAPHQL_URL,
  });
  const websocketLink = new GraphQLWsLink(
    createClient({
      lazy: true,
      retryAttempts: 5,
      shouldRetry: () => true,
      url: publicEnvironment.VITE_WS_URL,
    }),
  );

  return new ApolloClient({
    cache: new InMemoryCache(),
    link: split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return (
          definition.kind === Kind.OPERATION_DEFINITION &&
          definition.operation === OperationTypeNode.SUBSCRIPTION
        );
      },
      websocketLink,
      httpLink,
    ),
  });
}

export const apolloClient = createApolloClient();
