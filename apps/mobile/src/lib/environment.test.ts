import { describe, expect, it } from 'vitest';

import { toWebSocketUrl } from './environment';

describe('mobile realtime environment', () => {
  it('derives secure and local WebSocket GraphQL URLs', () => {
    expect(toWebSocketUrl('https://api.example.com/graphql')).toBe(
      'wss://api.example.com/graphql',
    );
    expect(toWebSocketUrl('http://192.168.1.2:4000/graphql')).toBe(
      'ws://192.168.1.2:4000/graphql',
    );
  });
});
