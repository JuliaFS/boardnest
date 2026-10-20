import { InMemoryCache } from '@apollo/client';
import { describe, expect, it } from 'vitest';

import {
  UNREAD_NOTIFICATION_COUNT_QUERY,
  type UnreadNotificationCountData,
} from '../core/graphql';
import { decrementUnreadNotificationCount } from './unread-notification-cache';

describe('unread notification cache', () => {
  it('decrements the cached count without going below zero', () => {
    const cache = new InMemoryCache();
    writeCount(cache, 2);

    decrementUnreadNotificationCount(cache);
    expect(readCount(cache)).toBe(1);

    writeCount(cache, 0);
    decrementUnreadNotificationCount(cache);
    expect(readCount(cache)).toBe(0);
  });

  it('does nothing before the count has been cached', () => {
    const cache = new InMemoryCache();

    expect(() => decrementUnreadNotificationCount(cache)).not.toThrow();
    expect(readCount(cache)).toBeUndefined();
  });
});

function readCount(cache: InMemoryCache): number | undefined {
  return cache.readQuery<UnreadNotificationCountData>({
    query: UNREAD_NOTIFICATION_COUNT_QUERY,
  })?.unreadNotificationCount;
}

function writeCount(cache: InMemoryCache, unreadNotificationCount: number) {
  cache.writeQuery<UnreadNotificationCountData>({
    data: { unreadNotificationCount },
    query: UNREAD_NOTIFICATION_COUNT_QUERY,
  });
}
