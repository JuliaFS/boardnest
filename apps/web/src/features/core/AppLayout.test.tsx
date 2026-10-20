import { MockedProvider } from '@apollo/client/testing/react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppLayout, UNREAD_NOTIFICATION_POLL_INTERVAL_MS } from './AppLayout';
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

afterEach(() => {
  cleanup();
  delete (document as { visibilityState?: string }).visibilityState;
  delete (navigator as { onLine?: boolean }).onLine;
});

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

  it('refetches the count when the browser tab becomes visible', async () => {
    renderLayout(2, 3);
    await screen.findByRole('link', {
      name: 'Notifications, 2 unread',
    });

    fireEvent(document, new Event('visibilitychange'));

    expect(
      await screen.findByRole('link', {
        name: 'Notifications, 3 unread',
      }),
    ).toBeTruthy();
  });

  it('polls the count every 60 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderLayout(4, 5);
      await screen.findByRole('link', { name: 'Notifications, 4 unread' });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(UNREAD_NOTIFICATION_POLL_INTERVAL_MS);
      });
      expect(
        await screen.findByRole('link', { name: 'Notifications, 5 unread' }),
      ).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops polling while the browser tab is hidden', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderLayout(6, 7);
      await screen.findByRole('link', { name: 'Notifications, 6 unread' });

      setVisibilityState('hidden');
      fireEvent(document, new Event('visibilitychange'));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(UNREAD_NOTIFICATION_POLL_INTERVAL_MS);
      });
      expect(
        screen.getByRole('link', { name: 'Notifications, 6 unread' }),
      ).toBeTruthy();

      setVisibilityState('visible');
      fireEvent(document, new Event('visibilitychange'));
      expect(
        await screen.findByRole('link', { name: 'Notifications, 7 unread' }),
      ).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('skips the count query while offline and loads it after reconnecting', async () => {
    setOnlineState(false);
    renderLayout(8);

    expect(screen.getByRole('link', { name: 'Notifications' })).toBeTruthy();

    setOnlineState(true);
    fireEvent(window, new Event('online'));
    expect(
      await screen.findByRole('link', { name: 'Notifications, 8 unread' }),
    ).toBeTruthy();
  });
});

function renderLayout(...unreadCounts: number[]) {
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <MockedProvider
        mocks={unreadCounts.map((unreadNotificationCount) => ({
          request: { query: UNREAD_NOTIFICATION_COUNT_QUERY },
          result: { data: { unreadNotificationCount } },
        }))}
      >
        <AppLayout />
      </MockedProvider>
    </MemoryRouter>,
  );
}

function setOnlineState(onLine: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value: onLine,
  });
}

function setVisibilityState(visibilityState: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: visibilityState,
  });
}
