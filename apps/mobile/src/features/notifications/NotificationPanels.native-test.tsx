import {
  MarkMobileNotificationAsReadDocument,
  MobileUnreadNotificationCountDocument,
} from '@boardnest/graphql-types';
import { InMemoryCache } from '@apollo/client';
import type { MockedResponse } from '@apollo/client/testing';
import { MockedProvider } from '@apollo/client/testing/react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { InboxPanel } from './NotificationPanels';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('./push-notifications', () => ({
  disablePushNotifications: jest.fn(),
  enablePushNotifications: jest.fn(),
  hasLocalPushRegistration: jest.fn(),
}));

const workspaceId = '35b70c1e-4b55-4a16-b85b-29c2fe513701';

const notification = {
  __typename: 'Notification' as const,
  body: 'You were added to Product Team.',
  createdAt: '2030-01-01T00:00:00.000Z',
  id: 'notification-id',
  projectId: null,
  readAt: null,
  reminderId: null,
  scheduledFor: null,
  taskId: null,
  title: 'Workspace membership updated',
  payload: {},
  type: 'workspace.member_added',
  workspaceId,
};

describe('InboxPanel', () => {
  beforeEach(() => mockPush.mockClear());

  test('opens the invitation screen for a registered recipient', async () => {
    const invitationId = '6992c303-a240-4e15-8fcc-461d53756324';
    const screen = await render(
      <MockedProvider>
        <InboxPanel
          data={{
            notifications: {
              nodes: [
                {
                  ...notification,
                  readAt: '2030-01-01T00:01:00Z',
                  type: 'workspace.invited',
                  title: 'Workspace invitation',
                  payload: { invitationId },
                },
              ],
              pageInfo: { hasNextPage: false, limit: 50, offset: 0 },
            },
          }}
          loading={false}
          onRetry={jest.fn()}
        />
      </MockedProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Open' }));
    expect(mockPush).toHaveBeenCalledWith(`/invite/${invitationId}`);
  });

  test('marks an unread notification optimistically and opens its native route', async () => {
    const cache = new InMemoryCache();
    cache.writeQuery({
      data: { unreadNotificationCount: 1 },
      query: MobileUnreadNotificationCountDocument,
    });
    const mutation: MockedResponse = {
      delay: 20,
      request: {
        query: MarkMobileNotificationAsReadDocument,
        variables: { id: notification.id },
      },
      result: {
        data: {
          markNotificationAsRead: {
            __typename: 'Notification',
            id: notification.id,
            readAt: '2030-01-01T00:01:00.000Z',
          },
        },
      },
    };
    const screen = await render(
      <MockedProvider cache={cache} mocks={[mutation]}>
        <InboxPanel
          data={{
            notifications: {
              nodes: [notification],
              pageInfo: { hasNextPage: false, limit: 25, offset: 0 },
            },
          }}
          loading={false}
          onRetry={jest.fn()}
        />
      </MockedProvider>,
    );

    expect(screen.getByText('Unread')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Open' }));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(`/workspaces/${workspaceId}`),
    );
    expect(
      cache.readQuery({ query: MobileUnreadNotificationCountDocument }),
    ).toEqual({ unreadNotificationCount: 0 });
  });

  test('does not issue another read mutation for an already-read item', async () => {
    const screen = await render(
      <MockedProvider>
        <InboxPanel
          data={{
            notifications: {
              nodes: [
                {
                  ...notification,
                  readAt: '2030-01-01T00:01:00.000Z',
                },
              ],
              pageInfo: { hasNextPage: false, limit: 25, offset: 0 },
            },
          }}
          loading={false}
          onRetry={jest.fn()}
        />
      </MockedProvider>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Open' }));
    expect(mockPush).toHaveBeenCalledWith(`/workspaces/${workspaceId}`);
    expect(screen.queryByText('Unread')).toBeNull();
  });
});
