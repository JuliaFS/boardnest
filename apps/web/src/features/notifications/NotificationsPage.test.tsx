import { MockedProvider } from '@apollo/client/testing/react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  NOTIFICATION_DELIVERIES_QUERY,
  NOTIFICATION_SETTINGS_QUERY,
  NOTIFICATIONS_QUERY,
  PROJECTS_QUERY,
  SCHEDULED_NOTIFICATIONS_QUERY,
  WORKSPACES_QUERY,
} from '../core/graphql';
import { NotificationsPage } from './NotificationsPage';

const workspaceId = '6992c303-a240-4e15-8fcc-461d53756324';

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
});

function notificationMocks() {
  return [
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
            nodes: [],
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
}
