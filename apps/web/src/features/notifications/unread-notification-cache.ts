import type { ApolloCache } from '@apollo/client';

import {
  UNREAD_NOTIFICATION_COUNT_QUERY,
  type UnreadNotificationCountData,
} from '../core/graphql';

export function decrementUnreadNotificationCount(cache: ApolloCache): void {
  const current = cache.readQuery<UnreadNotificationCountData>({
    query: UNREAD_NOTIFICATION_COUNT_QUERY,
  });
  if (!current) return;

  cache.writeQuery<UnreadNotificationCountData>({
    data: {
      unreadNotificationCount: Math.max(0, current.unreadNotificationCount - 1),
    },
    query: UNREAD_NOTIFICATION_COUNT_QUERY,
  });
}
