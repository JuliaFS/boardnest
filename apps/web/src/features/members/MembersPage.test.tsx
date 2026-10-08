import { MockedProvider } from '@apollo/client/testing/react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  WORKSPACE_INVITATIONS_QUERY,
  WORKSPACE_MEMBERS_QUERY,
  WORKSPACES_QUERY,
} from '../core/graphql';
import { MembersPage } from './MembersPage';

const userId = '4ac60f36-9f7a-419f-b447-d8f9d2bc7cd8';
const workspaceId = '6992c303-a240-4e15-8fcc-461d53756324';
const timestamp = new Date(0).toISOString();

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: {
      displayName: 'Workspace Owner',
      email: 'owner@example.com',
      id: userId,
      isAnonymous: false,
    },
  }),
}));

afterEach(cleanup);

describe('MembersPage', () => {
  it('shows the workspace roster and management actions to an owner', async () => {
    render(
      <MemoryRouter>
        <MockedProvider
          mocks={[
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
                        updatedAt: timestamp,
                      },
                    ],
                    pageInfo: { hasNextPage: false, limit: 25, offset: 0 },
                  },
                },
              },
            },
            {
              request: {
                query: WORKSPACE_MEMBERS_QUERY,
                variables: { workspaceId },
              },
              result: {
                data: {
                  workspaceMembers: {
                    nodes: [
                      {
                        avatarUrl: null,
                        displayName: 'Workspace Owner',
                        joinedAt: timestamp,
                        role: 'OWNER',
                        updatedAt: timestamp,
                        userId,
                        workspaceId,
                      },
                    ],
                    pageInfo: { hasNextPage: false, limit: 100, offset: 0 },
                  },
                },
              },
            },
            {
              request: {
                query: WORKSPACE_INVITATIONS_QUERY,
                variables: { workspaceId },
              },
              result: {
                data: {
                  workspaceInvitations: {
                    nodes: [],
                    pageInfo: { hasNextPage: false, limit: 100, offset: 0 },
                  },
                },
              },
            },
          ]}
        >
          <MembersPage />
        </MockedProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Workspace Owner')).toBeTruthy();
    expect(
      await screen.findByRole('button', { name: 'Invite member' }),
    ).toBeTruthy();
    expect(
      await screen.findByText('There are no pending invitations.'),
    ).toBeTruthy();
  });
});
