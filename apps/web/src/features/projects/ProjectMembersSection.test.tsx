import { MockedProvider } from '@apollo/client/testing/react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ADD_PROJECT_MEMBER_MUTATION,
  PROJECT_MEMBERS_QUERY,
  WORKSPACE_MEMBERS_QUERY,
} from '../core/graphql';
import { ProjectMembersSection } from './ProjectMembersSection';

const ownerId = '4ac60f36-9f7a-419f-b447-d8f9d2bc7cd8';
const memberId = 'b6067e89-1702-49b6-92f7-d2f2ccbc4685';
const workspaceId = '6992c303-a240-4e15-8fcc-461d53756324';
const projectId = 'f2410cb7-47f6-4af6-8ed9-f1d7a45158fc';
const timestamp = new Date(0).toISOString();

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: {
      displayName: 'Workspace Owner',
      email: 'owner@example.com',
      id: ownerId,
      isAnonymous: false,
    },
  }),
}));

afterEach(cleanup);

describe('ProjectMembersSection', () => {
  it('lets a workspace owner add an existing workspace member', async () => {
    const user = userEvent.setup();
    const ownerProjectMember = {
      avatarUrl: null,
      displayName: 'Workspace Owner',
      joinedAt: timestamp,
      projectId,
      role: 'PROJECT_LEAD',
      updatedAt: timestamp,
      userId: ownerId,
      workspaceId,
      workspaceRole: 'OWNER',
    };
    const addedProjectMember = {
      ...ownerProjectMember,
      displayName: 'Project Member',
      role: 'MEMBER',
      userId: memberId,
      workspaceRole: 'MEMBER',
    };
    let projectMemberReads = 0;

    render(
      <MockedProvider
        mocks={[
          {
            maxUsageCount: 2,
            request: {
              query: PROJECT_MEMBERS_QUERY,
              variables: { projectId },
            },
            result: () => ({
              data: {
                projectMembers: {
                  nodes:
                    projectMemberReads++ === 0
                      ? [ownerProjectMember]
                      : [ownerProjectMember, addedProjectMember],
                  pageInfo: { hasNextPage: false, limit: 100, offset: 0 },
                },
              },
            }),
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
                      userId: ownerId,
                      workspaceId,
                    },
                    {
                      avatarUrl: null,
                      displayName: 'Project Member',
                      joinedAt: timestamp,
                      role: 'MEMBER',
                      updatedAt: timestamp,
                      userId: memberId,
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
              query: ADD_PROJECT_MEMBER_MUTATION,
              variables: { projectId, role: 'MEMBER', userId: memberId },
            },
            result: {
              data: {
                addProjectMember: {
                  projectId,
                  role: 'MEMBER',
                  userId: memberId,
                  workspaceRole: 'MEMBER',
                },
              },
            },
          },
        ]}
      >
        <ProjectMembersSection
          projectId={projectId}
          visibility="PRIVATE"
          workspaceId={workspaceId}
        />
      </MockedProvider>,
    );

    await user.selectOptions(
      await screen.findByLabelText('Workspace member'),
      memberId,
    );
    await user.click(screen.getByRole('button', { name: 'Add member' }));

    await waitFor(() => {
      expect(
        screen.getByText('All workspace members are assigned'),
      ).toBeTruthy();
    });
  });
});
