import { gql } from '@apollo/client';
import { describe, expect, it, vi } from 'vitest';

import {
  createTimeoutFetch,
  OfflineMutationError,
  operationType,
  shouldBlockOfflineMutation,
  shouldRetryNetworkOperation,
} from './apollo-policy';
import { createActivityGate } from './realtime-events';

describe('mobile realtime activity gate', () => {
  it('pauses reconnect work until the application becomes active', async () => {
    const gate = createActivityGate(false);
    let resumed = false;
    const waiting = gate.waitUntilActive().then(() => {
      resumed = true;
    });
    await Promise.resolve();
    expect(resumed).toBe(false);
    gate.setActive(true);
    await waiting;
    expect(resumed).toBe(true);
  });
});

describe('mobile Apollo request policy', () => {
  it('identifies operations before applying retry rules', () => {
    const query = gql`
      query Connection {
        currentUser {
          id
        }
      }
    `;
    const mutation = gql`
      mutation Save {
        signOut
      }
    `;

    expect(operationType(query)).toBe('query');
    expect(operationType(mutation)).toBe('mutation');
    expect(shouldRetryNetworkOperation(query, true)).toBe(true);
    expect(shouldRetryNetworkOperation(mutation, true)).toBe(false);
    expect(shouldBlockOfflineMutation(mutation, false)).toBe(true);
    expect(shouldBlockOfflineMutation(mutation, true)).toBe(false);
  });

  it('aborts a request that exceeds the mobile timeout', async () => {
    vi.useFakeTimers();
    const fetchImplementation = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          );
        }),
    ) as unknown as typeof fetch;
    const request = createTimeoutFetch(
      fetchImplementation,
      50,
    )('https://boardnest.example/graphql');
    const rejection = expect(request).rejects.toMatchObject({
      name: 'AbortError',
    });
    await vi.advanceTimersByTimeAsync(50);

    await rejection;
    vi.useRealTimers();
  });

  it('provides an actionable offline mutation error', () => {
    expect(new OfflineMutationError().message).toContain(
      'requires an internet connection',
    );
  });
});
