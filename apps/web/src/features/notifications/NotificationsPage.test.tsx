import { InMemoryCache } from '@apollo/client';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockedResponse } from '@apollo/client/testing';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  NOTIFICATION_DELIVERIES_QUERY,
  NOTIFICATION_SETTINGS_QUERY,
  NOTIFICATIONS_QUERY,
  MARK_NOTIFICATION_AS_READ_MUTATION,
  PROJECTS_QUERY,
  SCHEDULED_NOTIFICATIONS_QUERY,
  UNREAD_NOTIFICATION_COUNT_QUERY,
  WORKSPACES_QUERY,
  type UnreadNotificationCountData,
} from '../core/graphql';
import { NotificationsPage } from './NotificationsPage';

const workspaceId = '6992c303-a240-4e15-8fcc-461d53756324';
const notificationId = '014b78ab-48c4-4ca5-815a-1055a2d38d9c';
const projectId = '7a1e63bf-715d-41c0-a81a-f86539d07d6e';
const taskId = 'b75e3536-a899-42b8-b136-305446ddae69';

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: {
      displayName: 'Test User',
      email: 'person@example.com',
      id: '4ac60f36-9f7a-419f-b447-d8f9d2bc7cd8',
      isAnonymous: false,
    },
  }),
}));

afterEach(cleanup);

describe('NotificationsPage', () => {
  it('shows an invitation before the recipient has joined any workspace', async () => {
    const user = userEvent.setup();
    const invitationId = '1251a531-5635-4fa7-a986-5d99780651dd';
    const mocks: MockedResponse[] = [
      {
        request: { query: WORKSPACES_QUERY },
        result: {
          data: {
            workspaces: {
              nodes: [],
              pageInfo: { hasNextPage: false, limit: 25, offset: 0 },
            },
          },
        },
      },
      {
        request: {
          query: NOTIFICATIONS_QUERY,
          variables: { unreadOnly: false },
        },
        result: {
          data: {
            notifications: {
              nodes: [
                notification({
                  title: 'Workspace invitation',
                  type: 'workspace.invited',
                  payload: { invitationId },
                  projectId: null,
                  taskId: null,
                  readAt: '2030-01-01T00:01:00Z',
                }),
              ],
              pageInfo: { hasNextPage: false, limit: 25, offset: 0 },
            },
          },
        },
      },
    ];
    render(
      <MemoryRouter>
        <MockedProvider mocks={mocks}>
          <>
            <NotificationsPage />
            <LocationProbe />
          </>
        </MockedProvider>
      </MemoryRouter>,
    );
    await user.click(
      await screen.findByRole('button', {
        name: 'Open notification: Workspace invitation',
      }),
    );
    expect(screen.getByTestId('location').textContent).toBe(
      `/invite/${invitationId}`,
    );
  });

  it('opens an accessible custom notification form with plan context', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <MockedProvider mocks={notificationMocks()}>
          <NotificationsPage />
        </MockedProvider>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('tab', { name: 'Schedules' }));
    expect(
      await screen.findByText('0 of 10 active custom schedules used.'),
    ).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'New notification' }));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(
      screen.getByRole<HTMLSelectElement>('combobox', {
        name: 'Recipient',
      }).value,
    ).toBe('self');
    expect(screen.getByText('person@example.com (you)')).toBeTruthy();
  });

  it('marks an unread routed notification as read before navigating', async () => {
    const user = userEvent.setup();
    const cache = unreadCountCache(5);
    render(
      <MemoryRouter initialEntries={['/notifications']}>
        <MockedProvider
          cache={cache}
          mocks={notificationMocks([
            notification({
              payload: {
                route: `/projects/${projectId}/tasks/${taskId}`,
              },
            }),
          ])}
        >
          <>
            <NotificationsPage />
            <LocationProbe />
          </>
        </MockedProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Unread')).toBeTruthy();
    const openButton = screen.getByRole('button', {
      name: 'Open notification: Task assigned',
    });
    openButton.focus();
    expect(document.activeElement).toBe(openButton);
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.queryByText('Unread')).toBeNull();
      expect(screen.getByTestId('location').textContent).toBe(
        `/projects/${projectId}/tasks/${taskId}`,
      );
      expect(readUnreadCount(cache)).toBe(4);
    });
  });

  it('restores and refetches the unread count when marking as read fails', async () => {
    const user = userEvent.setup();
    const item = notification();
    const cache = unreadCountCache(5);
    const mocks = notificationMocks([item], false);
    mocks.push(
      {
        request: {
          query: MARK_NOTIFICATION_AS_READ_MUTATION,
          variables: { id: item.id },
        },
        delay: 50,
        error: new Error('Mutation failed'),
      },
      {
        request: { query: UNREAD_NOTIFICATION_COUNT_QUERY },
        result: { data: { unreadNotificationCount: 6 } },
      },
    );

    render(
      <MemoryRouter initialEntries={['/notifications']}>
        <MockedProvider cache={cache} mocks={mocks}>
          <NotificationsPage />
        </MockedProvider>
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole('button', {
        name: 'Open notification: Task assigned',
      }),
    );
    expect(readUnreadCount(cache)).toBe(4);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(readUnreadCount(cache)).toBe(6);
    });
  });

  it('offers a separate mark-as-read action when no route is present', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/notifications']}>
        <MockedProvider
          mocks={notificationMocks([
            notification({
              payload: { route: 'https://external.example/collect' },
              projectId: null,
              taskId: null,
              workspaceId: 'invalid-workspace-id',
            }),
          ])}
        >
          <>
            <NotificationsPage />
            <LocationProbe />
          </>
        </MockedProvider>
      </MemoryRouter>,
    );

    const markButton = await screen.findByRole('button', {
      name: 'Mark as read',
    });
    expect(
      screen.queryByRole('button', {
        name: 'Open notification: Task assigned',
      }),
    ).toBeNull();

    await user.click(markButton);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Mark as read' })).toBeNull();
      expect(screen.getByTestId('location').textContent).toBe('/notifications');
    });
  });

  it('derives a task route when payload.route is missing', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/notifications']}>
        <MockedProvider mocks={notificationMocks([notification()])}>
          <>
            <NotificationsPage />
            <LocationProbe />
          </>
        </MockedProvider>
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole('button', {
        name: 'Open notification: Task assigned',
      }),
    );

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(
        `/projects/${projectId}/tasks/${taskId}`,
      );
    });
  });

  it.each([
    {
      expected: `/projects/${projectId}`,
      notification: notification({ taskId: null }),
      title: 'project',
    },
    {
      expected: `/workspaces/${workspaceId}`,
      notification: notification({ projectId: null, taskId: null }),
      title: 'workspace',
    },
  ])(
    'derives and opens the $title fallback route',
    async ({ expected, notification: item }) => {
      const user = userEvent.setup();
      render(
        <MemoryRouter initialEntries={['/notifications']}>
          <MockedProvider mocks={notificationMocks([item])}>
            <>
              <NotificationsPage />
              <LocationProbe />
            </>
          </MockedProvider>
        </MemoryRouter>,
      );

      await user.click(
        await screen.findByRole('button', {
          name: 'Open notification: Task assigned',
        }),
      );

      await waitFor(() => {
        expect(screen.getByTestId('location').textContent).toBe(expected);
      });
    },
  );

  it('opens an already-read notification without repeating the mutation', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/notifications']}>
        <MockedProvider
          mocks={notificationMocks(
            [
              notification({
                payload: { route: `/projects/${projectId}` },
                readAt: '2030-01-15T11:00:00.000Z',
              }),
            ],
            false,
          )}
        >
          <>
            <NotificationsPage />
            <LocationProbe />
          </>
        </MockedProvider>
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole('button', {
        name: 'Open notification: Task assigned',
      }),
    );

    expect(screen.getByTestId('location').textContent).toBe(
      `/projects/${projectId}`,
    );
  });
});

function notificationMocks(
  notifications: ReturnType<typeof notification>[] = [],
  includeMarkMutation = true,
) {
  const mocks: MockedResponse[] = [
    {
      request: { query: WORKSPACES_QUERY },
      result: {
        data: {
          workspaces: {
            nodes: [
              {
                id: workspaceId,
                name: 'Product team',
                slug: 'product-team',
                updatedAt: new Date(0).toISOString(),
              },
            ],
            pageInfo: { hasNextPage: false, limit: 25, offset: 0 },
          },
        },
      },
    },
    {
      request: {
        query: PROJECTS_QUERY,
        variables: { workspaceId },
      },
      result: {
        data: {
          projects: {
            nodes: [],
            pageInfo: { hasNextPage: false, limit: 25, offset: 0 },
          },
        },
      },
    },
    {
      request: {
        query: NOTIFICATIONS_QUERY,
        variables: { unreadOnly: false },
      },
      result: {
        data: {
          notifications: {
            nodes: notifications,
            pageInfo: { hasNextPage: false, limit: 25, offset: 0 },
          },
        },
      },
    },
    {
      request: {
        query: SCHEDULED_NOTIFICATIONS_QUERY,
        variables: { workspaceId },
      },
      result: { data: { scheduledNotifications: [] } },
    },
    {
      request: {
        query: NOTIFICATION_SETTINGS_QUERY,
        variables: { workspaceId },
      },
      result: {
        data: {
          notificationEventPreferences: [],
          notificationEventTypes: [],
          notificationPlanEvents: [],
          notificationPreferences: {
            emailEnabled: true,
            inAppEnabled: true,
          },
          workspaceSubscription: {
            effectivePlanCode: 'free',
            plan: {
              code: 'free',
              displayName: 'Free',
              emailEnabled: true,
              maxScheduledNotifications: 10,
              minScheduleIntervalMinutes: 60,
              monthlyEmailLimit: 100,
            },
          },
        },
      },
    },
    {
      request: {
        query: NOTIFICATION_DELIVERIES_QUERY,
        variables: { workspaceId },
      },
      result: {
        data: {
          notificationDeliveries: {
            nodes: [],
            pageInfo: { hasNextPage: false, limit: 25, offset: 0 },
          },
        },
      },
    },
  ];

  if (notifications.length && includeMarkMutation) {
    const firstNotification = notifications[0];
    if (!firstNotification) return mocks;
    mocks.push({
      request: {
        query: MARK_NOTIFICATION_AS_READ_MUTATION,
        variables: { id: firstNotification.id },
      },
      result: {
        data: {
          markNotificationAsRead: {
            __typename: 'Notification',
            id: firstNotification.id,
            readAt: '2030-01-15T12:00:00.000Z',
          },
        },
      },
    });
  }

  return mocks;
}

function notification(
  overrides: Partial<{
    title: string;
    type: string;
    payload: Record<string, unknown>;
    projectId: string | null;
    readAt: string | null;
    taskId: string | null;
    workspaceId: string;
  }> = {},
) {
  return {
    __typename: 'Notification',
    body: 'You were assigned to Prepare release.',
    createdAt: '2030-01-15T10:00:00.000Z',
    id: notificationId,
    payload: {},
    projectId,
    readAt: null,
    reminderId: null,
    scheduledFor: null,
    taskId,
    title: 'Task assigned',
    type: 'task.assigned',
    workspaceId,
    ...overrides,
  };
}

function unreadCountCache(unreadNotificationCount: number) {
  const cache = new InMemoryCache();
  cache.writeQuery<UnreadNotificationCountData>({
    data: { unreadNotificationCount },
    query: UNREAD_NOTIFICATION_COUNT_QUERY,
  });
  return cache;
}

function readUnreadCount(cache: InMemoryCache) {
  return cache.readQuery<UnreadNotificationCountData>({
    optimistic: true,
    query: UNREAD_NOTIFICATION_COUNT_QUERY,
  })?.unreadNotificationCount;
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}
