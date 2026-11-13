import {
  AcceptMobileWorkspaceInvitationDocument,
  AcceptMobileWorkspaceInvitationByIdDocument,
  MobileWorkspacesDocument,
} from '@boardnest/graphql-types';
import { useQuery } from '@apollo/client/react';
import { MockedProvider } from '@apollo/client/testing/react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import InvitationDeepLinkScreen from '@/app/invite/[token]';

let mockInvitation = '';
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ token: mockInvitation }),
  useRouter: () => ({ replace: mockReplace }),
}));

const invitationId = '6992c303-a240-4e15-8fcc-461d53756324';
const workspaceId = '35b70c1e-4b55-4a16-b85b-29c2fe513701';

function WorkspacesObserver() {
  useQuery(MobileWorkspacesDocument);
  return null;
}

describe('mobile invitation acceptance', () => {
  test.each([false, true])(
    'accepts an invitation with byId=%s',
    async (byId) => {
      mockInvitation = byId ? invitationId : 'a'.repeat(43);
      const screen = await render(
        <MockedProvider
          mocks={[
            {
              request: { query: MobileWorkspacesDocument },
              maxUsageCount: 2,
              result: {
                data: {
                  workspaces: {
                    nodes: [],
                    pageInfo: { hasNextPage: false, limit: 50, offset: 0 },
                  },
                },
              },
            },
            {
              request: {
                query: byId
                  ? AcceptMobileWorkspaceInvitationByIdDocument
                  : AcceptMobileWorkspaceInvitationDocument,
                variables: byId
                  ? { id: mockInvitation }
                  : { token: mockInvitation },
              },
              result: {
                data: {
                  acceptInvitation: {
                    workspaceId,
                    userId: invitationId,
                    role: 'MEMBER',
                    joinedAt: '2030-01-01T00:00:00Z',
                  },
                },
              },
            },
          ]}
        >
          <>
            <WorkspacesObserver />
            <InvitationDeepLinkScreen />
          </>
        </MockedProvider>,
      );
      await fireEvent.press(
        screen.getByRole('button', { name: 'Accept invitation' }),
      );
      await waitFor(() =>
        expect(screen.getByText('Invitation accepted')).toBeTruthy(),
      );
      await fireEvent.press(
        screen.getByRole('button', { name: 'Open workspace' }),
      );
      expect(mockReplace).toHaveBeenCalledWith(`/workspaces/${workspaceId}`);
    },
  );
});
