import { useQuery } from '@apollo/client/react';

import { NOTIFICATIONS_QUERY, type NotificationsData } from '../core/graphql';
import { PageHeader } from '../core/PageHeader';
import { EmptyState, PageSkeleton, QueryError } from '../core/QueryState';

export function NotificationsPage() {
  const result = useQuery<NotificationsData>(NOTIFICATIONS_QUERY, {
    variables: { unreadOnly: false },
  });

  if (result.loading) return <PageSkeleton />;
  if (result.error) {
    return (
      <QueryError
        message={result.error.message}
        onRetry={() => void result.refetch()}
      />
    );
  }

  const notifications = result.data?.notifications.nodes ?? [];

  return (
    <>
      <PageHeader
        description="Updates addressed to your account across every workspace."
        eyebrow="Inbox"
        title="Notifications"
      />
      {notifications.length === 0 ? (
        <EmptyState
          description="Updates about tasks, invitations and projects will appear here."
          title="You're all caught up"
        />
      ) : (
        <div className="grid gap-3">
          {notifications.map((notification) => (
            <article
              className={`rounded-2xl border p-5 ${
                notification.readAt
                  ? 'border-slate-800 bg-slate-900/40'
                  : 'border-indigo-400/30 bg-indigo-400/5'
              }`}
              key={notification.id}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-slate-100">
                    {notification.title}
                  </h2>
                  {notification.body ? (
                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      {notification.body}
                    </p>
                  ) : null}
                </div>
                {!notification.readAt ? (
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-indigo-300" />
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
