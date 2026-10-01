import { MockedProvider } from '@apollo/client/testing/react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PROJECTS_QUERY, WORKSPACES_QUERY } from '../core/graphql';
import { ProjectsPage } from './ProjectsPage';

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { displayName: 'Guest', email: null, id: 'guest', isAnonymous: true },
  }),
}));

afterEach(cleanup);

describe('ProjectsPage', () => {
  it('explains the workspace limit instead of opening the form for a guest', async () => {
    const user = userEvent.setup();
    const workspace = {
      id: '6992c303-a240-4e15-8fcc-461d53756324',
      name: 'Guest workspace',
      slug: 'guest-workspace',
      updatedAt: new Date(0).toISOString(),
    };
    render(
      <MemoryRouter>
        <MockedProvider
          mocks={[
            {
              request: { query: WORKSPACES_QUERY },
              result: {
                data: {
                  workspaces: {
                    nodes: [workspace],
                    pageInfo: { hasNextPage: false, limit: 25, offset: 0 },
                  },
                },
              },
            },
            {
              request: {
                query: PROJECTS_QUERY,
                variables: { workspaceId: workspace.id },
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
          ]}
        >
          <ProjectsPage />
        </MockedProvider>
      </MemoryRouter>,
    );

    await user.click(
      await screen.findByRole('button', { name: 'New workspace' }),
    );

    expect(
      screen.getByText(
        'Guest users can create only one workspace. You can continue using your existing workspace.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
