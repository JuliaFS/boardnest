import { ApolloClient, HttpLink, InMemoryCache, split } from '@apollo/client';
import { SetContextLink } from '@apollo/client/link/context';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { Kind, OperationTypeNode } from 'graphql';
import {
  createClient as createGraphQLWsClient,
  type Client as GraphQLWsClient,
} from 'graphql-ws';

import { mobileEnvironment } from './environment';
import { createActivityGate } from './realtime-events';
import { mobileSupabase } from './supabase';

type MobileApolloOptions = {
  fetchImplementation?: typeof fetch;
  uri?: string;
  websocketImplementation?: typeof WebSocket;
  websocketUri?: string;
};

type RealtimeController = {
  dispose: () => Promise<void>;
  reconnect: () => void;
  setActive: (active: boolean) => void;
};

let defaultRealtimeController: RealtimeController | null = null;

export function createMobileApolloClient({
  fetchImplementation = fetch,
  uri = mobileEnvironment.graphqlUrl,
  websocketImplementation = typeof globalThis.WebSocket === 'function'
    ? globalThis.WebSocket
    : undefined,
  websocketUri = mobileEnvironment.websocketUrl,
}: MobileApolloOptions = {}) {
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
  const httpLink = authenticationLink.concat(
    new HttpLink({ credentials: 'omit', fetch: fetchImplementation, uri }),
  );

  let realtime: RealtimeController | null = null;
  let link = httpLink;

  if (websocketImplementation) {
    const activity = createActivityGate();
    const websocketClient = createGraphQLWsClient({
      connectionParams: async () => {
        const { data } = await mobileSupabase.auth.getSession();
        const accessToken = data.session?.access_token;
        return accessToken ? { authorization: `Bearer ${accessToken}` } : {};
      },
      keepAlive: 15_000,
      lazy: true,
      on: {
        connected: (_socket, _payload, wasRetry) => {
          if (wasRetry) void client.refetchQueries({ include: 'active' });
        },
      },
      retryAttempts: Number.POSITIVE_INFINITY,
      retryWait: async (retries) => {
        await activity.waitUntilActive();
        await wait(Math.min(1_000 * 2 ** Math.min(retries, 5), 30_000));
      },
      shouldRetry: () => true,
      url: websocketUri,
      webSocketImpl: websocketImplementation,
    });
    const websocketLink = new GraphQLWsLink(websocketClient);
    link = split(isSubscriptionOperation, websocketLink, httpLink);
    realtime = createRealtimeController(websocketClient, activity);
  }

  const client = new ApolloClient({ cache: new InMemoryCache(), link });
  return { client, realtime };
}

const defaultTransport = createMobileApolloClient();
export const mobileApolloClient = defaultTransport.client;
defaultRealtimeController = defaultTransport.realtime;

export function setMobileRealtimeActive(active: boolean): void {
  defaultRealtimeController?.setActive(active);
}

export function reconnectMobileRealtime(): void {
  defaultRealtimeController?.reconnect();
}

function createRealtimeController(
  client: GraphQLWsClient,
  activity: ReturnType<typeof createActivityGate>,
): RealtimeController {
  let active = true;
  return {
    dispose: () => Promise.resolve(client.dispose()),
    reconnect: () => client.terminate(),
    setActive(nextActive) {
      if (nextActive === active) return;
      active = nextActive;
      activity.setActive(nextActive);
      if (!nextActive) client.terminate();
    },
  };
}

function isSubscriptionOperation({ query }: { query: unknown }): boolean {
  const definition = getMainDefinition(
    query as Parameters<typeof getMainDefinition>[0],
  );
  return (
    definition.kind === Kind.OPERATION_DEFINITION &&
    definition.operation === OperationTypeNode.SUBSCRIPTION
  );
}

function readStringHeaders(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
