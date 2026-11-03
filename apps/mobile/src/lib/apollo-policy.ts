import { getMainDefinition } from '@apollo/client/utilities';
import { Kind, OperationTypeNode } from 'graphql';

export const MOBILE_REQUEST_TIMEOUT_MS = 15_000;

export class OfflineMutationError extends Error {
  constructor() {
    super(
      'This change requires an internet connection. Please try again when you are online.',
    );
    this.name = 'OfflineMutationError';
  }
}

export function operationType(
  query: Parameters<typeof getMainDefinition>[0],
): OperationTypeNode | null {
  const definition = getMainDefinition(query);
  return definition.kind === Kind.OPERATION_DEFINITION
    ? definition.operation
    : null;
}

export function shouldBlockOfflineMutation(
  query: Parameters<typeof getMainDefinition>[0],
  isOnline: boolean,
): boolean {
  return !isOnline && operationType(query) === OperationTypeNode.MUTATION;
}

export function shouldRetryNetworkOperation(
  query: Parameters<typeof getMainDefinition>[0],
  isOnline: boolean,
): boolean {
  return isOnline && operationType(query) === OperationTypeNode.QUERY;
}

export function createTimeoutFetch(
  fetchImplementation: typeof fetch,
  timeoutMilliseconds = MOBILE_REQUEST_TIMEOUT_MS,
): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    const upstreamSignal = init?.signal;
    const abortFromUpstream = () => controller.abort();
    upstreamSignal?.addEventListener('abort', abortFromUpstream, {
      once: true,
    });
    const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds);

    try {
      return await fetchImplementation(input, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
      upstreamSignal?.removeEventListener('abort', abortFromUpstream);
    }
  };
}
