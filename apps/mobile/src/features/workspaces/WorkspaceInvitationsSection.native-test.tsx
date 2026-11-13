import {
  ChangeMobileInvitationEmailDocument,
  MobileWorkspaceInvitationsDocument,
} from '@boardnest/graphql-types';
import { MockedProvider } from '@apollo/client/testing/react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { WorkspaceInvitationsSection } from './WorkspaceInvitationsSection';

jest.mock('@/lib/environment', () => ({
  mobileEnvironment: { webUrl: 'http://localhost:5173' },
}));
const workspaceId = '35b70c1e-4b55-4a16-b85b-29c2fe513701';
const invitation = {
  id: '6992c303-a240-4e15-8fcc-461d53756324',
  workspaceId,
  email: 'wrong@example.com',
  role: 'VIEWER',
  status: 'PENDING',
  expiresAt: '2030-01-01T00:00:00Z',
  createdAt: '2026-11-13T00:00:00Z',
};
const replacement = {
  ...invitation,
  id: workspaceId,
  email: 'correct@example.com',
};
const list = (nodes: (typeof invitation)[]) => ({
  data: {
    workspaceInvitations: {
      nodes,
      pageInfo: { hasNextPage: false, limit: 100, offset: 0 },
    },
  },
});

test('changes a pending invitation email through the native edit sheet', async () => {
  const changed = jest.fn(() => ({
    data: {
      inviteMember: {
        invitation: replacement,
        emailSent: true,
        token: null,
      },
    },
  }));
  const screen = await render(
    <MockedProvider
      mocks={[
        {
          request: {
            query: MobileWorkspaceInvitationsDocument,
            variables: { workspaceId },
          },
          result: list([invitation]),
        },
        {
          request: {
            query: ChangeMobileInvitationEmailDocument,
            variables: { id: invitation.id, email: 'correct@example.com' },
          },
          result: changed,
        },
        {
          request: {
            query: MobileWorkspaceInvitationsDocument,
            variables: { workspaceId },
          },
          result: list([replacement]),
        },
      ]}
    >
      <WorkspaceInvitationsSection
        workspaceId={workspaceId}
        isAnonymous={false}
      />
    </MockedProvider>,
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Change email' })).toBeTruthy(),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Change email' }));
  expect(screen.getByLabelText('Email').props.value).toBe('wrong@example.com');
  await fireEvent.changeText(
    screen.getByLabelText('Email'),
    ' CORRECT@example.com ',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Save email' }));
  await waitFor(() =>
    expect(screen.getByText('Invitation email changed')).toBeTruthy(),
  );
  expect(changed).toHaveBeenCalledTimes(1);
});
