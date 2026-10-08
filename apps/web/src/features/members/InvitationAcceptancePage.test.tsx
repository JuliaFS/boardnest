import { MockedProvider } from '@apollo/client/testing/react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ACCEPT_INVITATION_MUTATION } from '../core/graphql';
import { InvitationAcceptancePage } from './InvitationAcceptancePage';

const token = 'a'.repeat(43);
const userId = '4ac60f36-9f7a-419f-b447-d8f9d2bc7cd8';
const workspaceId = '6992c303-a240-4e15-8fcc-461d53756324';

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: {
      displayName: 'Invited Member',
      email: 'member@example.com',
      id: userId,
      isAnonymous: false,
    },
  }),
}));

afterEach(cleanup);

describe('InvitationAcceptancePage', () => {
  it('accepts a valid invitation for the signed-in account', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[`/invite/${token}`]}>
        <MockedProvider
          mocks={[
            {
              request: {
                query: ACCEPT_INVITATION_MUTATION,
                variables: { token },
              },
              result: {
                data: {
                  acceptInvitation: {
                    joinedAt: new Date(0).toISOString(),
                    role: 'MEMBER',
                    userId,
                    workspaceId,
                  },
                },
              },
            },
          ]}
        >
          <Routes>
            <Route
              element={<InvitationAcceptancePage />}
              path="/invite/:token"
            />
          </Routes>
        </MockedProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Accept invitation' }));

    expect(await screen.findByText('Invitation accepted')).toBeTruthy();
    expect(
      screen.getByText('You joined the workspace as Member.'),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Open workspace' }).getAttribute('href'),
    ).toBe(`/workspaces/${workspaceId}`);
  });
});
