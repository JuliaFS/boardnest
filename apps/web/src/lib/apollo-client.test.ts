import { MobileConnectionDocument } from '@boardnest/graphql-types';
import { describe, expect, it, vi } from 'vitest';

import { createApolloClient } from './apollo-client';

describe('Apollo Client', () => {
  it('includes HttpOnly authentication cookies in GraphQL requests', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: { currentUser: null } }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );
    const client = createApolloClient(fetchMock);

    await client.query({
      fetchPolicy: 'network-only',
      query: MobileConnectionDocument,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      credentials: 'include',
      method: 'POST',
    });
  });
});
