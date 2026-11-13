import {
  AcceptMobileWorkspaceInvitationDocument,
  AcceptMobileWorkspaceInvitationByIdDocument,
  MobileWorkspacesDocument,
  type AcceptMobileWorkspaceInvitationMutation,
} from '@boardnest/graphql-types';
import { useMutation } from '@apollo/client/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { AppBanner, AppButton, AppScreen } from '@/components/ui';
import { mobileRoutes } from '@/navigation/routes';

export default function InvitationDeepLinkScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string | string[] }>();
  const invitationToken = Array.isArray(token) ? token[0] : token;
  const byId = Boolean(
    invitationToken &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      invitationToken,
    ),
  );
  const validToken =
    byId ||
    Boolean(invitationToken && /^[A-Za-z0-9_-]{43}$/.test(invitationToken));
  const [acceptInvitation, state] = useMutation<
    AcceptMobileWorkspaceInvitationMutation,
    { token?: string; id?: string }
  >(
    byId
      ? AcceptMobileWorkspaceInvitationByIdDocument
      : AcceptMobileWorkspaceInvitationDocument,
    { refetchQueries: [MobileWorkspacesDocument] },
  );
  const accepted = state.data?.acceptInvitation;

  async function accept() {
    if (!invitationToken || !validToken) return;
    try {
      await acceptInvitation({
        variables: byId ? { id: invitationToken } : { token: invitationToken },
      });
    } catch {
      // Apollo exposes the invitation error through state.
    }
  }

  return (
    <AppScreen
      description="Invitation acceptance is protected by your authenticated email address."
      eyebrow="INVITATION"
      title={accepted ? 'Invitation accepted' : 'Workspace invitation'}
    >
      {accepted ? (
        <>
          <AppBanner
            message={`You joined the workspace as ${accepted.role.toLowerCase()}.`}
            title="Welcome to the workspace"
            tone="success"
          />
          <AppButton
            label="Open workspace"
            onPress={() =>
              router.replace(mobileRoutes.workspace(accepted.workspaceId))
            }
          />
        </>
      ) : !validToken ? (
        <AppBanner
          message="The invitation token is missing or malformed. Ask the workspace administrator for a new invitation."
          title="Invalid invitation link"
          tone="error"
        />
      ) : (
        <View>
          <AppButton
            label="Accept invitation"
            loading={state.loading}
            onPress={() => void accept()}
          />
        </View>
      )}
      {state.error ? (
        <AppBanner
          message={state.error.message}
          title="Invitation could not be accepted"
          tone="error"
        />
      ) : null}
      <AppButton
        label="Return to dashboard"
        onPress={() => router.replace(mobileRoutes.dashboard)}
        variant="ghost"
      />
    </AppScreen>
  );
}
