import { MockedProvider } from '@apollo/client/testing/react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppLayout } from './AppLayout';
import { UNREAD_NOTIFICATION_COUNT_QUERY } from './graphql';

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    signOut: vi.fn(),
    user: {
      displayName: 'Test User',
      email: 'person@example.com',
      id: '4ac60f36-9f7a-419f-b447-d8f9d2bc7cd8',
      isAnonymous: false,
    },
  }),
}));

afterEach(cleanup);

describe('AppLayout notification badge', () => {
  it('hides the badge when there are no unread notifications', async () => {
    renderLayout(0);

    const link = await screen.findByRole('link', { name: 'Notifications' });
    expect(within(link).queryByText('0')).toBeNull();
  });

  it.each([
    [1, '1'],
    [99, '99'],
    [100, '99+'],
  ])(
    'shows an accessible badge for %i unread notifications',
    async (count, visibleLabel) => {
      renderLayout(count);

      const link = await screen.findByRole('link', {
        name: `Notifications, ${count} unread`,
      });
      expect(within(link).getByText(visibleLabel)).toBeTruthy();
    },
  );
});

function renderLayout(unreadNotificationCount: number) {
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <MockedProvider
        mocks={[
          {
            request: { query: UNREAD_NOTIFICATION_COUNT_QUERY },
            result: { data: { unreadNotificationCount } },
          },
        ]}
      >
        <AppLayout />
      </MockedProvider>
    </MemoryRouter>,
  );
}
