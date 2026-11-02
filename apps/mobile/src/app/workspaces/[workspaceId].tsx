import {
  MobileWorkspaceDetailsDocument,
  UpdateMobileWorkspaceMemberRoleDocument,
  type MobileWorkspaceDetailsQuery,
  type WorkspaceRole,
} from '@boardnest/graphql-types';
import { useMutation, useQuery } from '@apollo/client/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  AppBanner,
  AppButton,
  AppScreen,
  BottomSheetModal,
  EmptyState,
  ErrorState,
  LoadingState,
  useFeedback,
} from '@/components/ui';
import { WorkspaceFormSheet } from '@/features/workspaces/WorkspaceFormSheet';
import { WorkspaceInvitationsSection } from '@/features/workspaces/WorkspaceInvitationsSection';
import {
  canManageWorkspace,
  workspaceRoleDescription,
} from '@/features/workspaces/workspace-model';
import { theme } from '@/theme';

type WorkspaceMember =
  MobileWorkspaceDetailsQuery['workspaceMembers']['nodes'][number];
const editableRoles = ['ADMIN', 'MEMBER', 'VIEWER'] as const;

export default function WorkspaceDetailsScreen() {
  const router = useRouter();
  const { showToast } = useFeedback();
  const { workspaceId } = useLocalSearchParams<{ workspaceId: string }>();
  const [showEditWorkspace, setShowEditWorkspace] = useState(false);
  const [selectedMember, setSelectedMember] = useState<WorkspaceMember | null>(
    null,
  );
  const { data, error, loading, refetch } = useQuery(
    MobileWorkspaceDetailsDocument,
    { skip: !workspaceId, variables: { id: workspaceId ?? '' } },
  );
  const [updateRole, roleState] = useMutation(
    UpdateMobileWorkspaceMemberRoleDocument,
  );
  const workspace = data?.workspace;
  const members = data?.workspaceMembers.nodes ?? [];
  const currentMembership = members.find(
    (member) => member.userId === data?.currentUser?.id,
  );
  const canManage = canManageWorkspace(currentMembership?.role);

  async function changeRole(role: WorkspaceRole) {
    if (!selectedMember || !workspaceId) return;
    try {
      await updateRole({
        variables: {
          role,
          userId: selectedMember.userId,
          workspaceId,
        },
      });
      await refetch();
      showToast({
        message: `${selectedMember.displayName} is now ${role.toLowerCase()}.`,
        tone: 'success',
      });
      setSelectedMember(null);
    } catch {
      // Apollo exposes the actionable GraphQL error through roleState.
    }
  }

  if (loading && !data) {
    return (
      <AppScreen title="Workspace">
        <LoadingState title="Loading workspace" />
      </AppScreen>
    );
  }
  if (error && !data) {
    return (
      <AppScreen title="Workspace">
        <ErrorState
          actionLabel="Try again"
          description={error.message}
          onAction={() => void refetch()}
          title="Workspace could not be loaded"
        />
      </AppScreen>
    );
  }
  if (!workspace) {
    return (
      <AppScreen title="Workspace">
        <EmptyState
          actionLabel="Go back"
          description="The workspace does not exist or your account no longer has access."
          onAction={() => router.back()}
          title="Workspace unavailable"
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      description={`/${workspace.slug}`}
      eyebrow="WORKSPACE"
      title={workspace.name}
    >
      <View style={styles.actions}>
        <AppButton label="Back" onPress={() => router.back()} variant="ghost" />
        {canManage ? (
          <AppButton
            label="Edit workspace"
            onPress={() => setShowEditWorkspace(true)}
            variant="secondary"
          />
        ) : null}
      </View>
      {currentMembership ? (
        <AppBanner
          message={workspaceRoleDescription(currentMembership.role)}
          title={`Your role: ${currentMembership.role.toLowerCase()}`}
          tone={canManage ? 'success' : 'info'}
        />
      ) : null}
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Members ({members.length})
        </Text>
        {members.map((member) => {
          const canEditMember =
            canManage &&
            member.role !== 'OWNER' &&
            member.userId !== data?.currentUser?.id;
          return (
            <View key={member.userId} style={styles.memberCard}>
              <View style={styles.memberIdentity}>
                <Text style={styles.memberName}>{member.displayName}</Text>
                <Text style={styles.memberRole}>
                  {member.role.toLowerCase()}
                  {member.userId === data?.currentUser?.id ? ' · you' : ''}
                </Text>
              </View>
              <Text style={styles.permissionDescription}>
                {workspaceRoleDescription(member.role)}
              </Text>
              {canEditMember ? (
                <AppButton
                  accessibilityLabel={`Change role for ${member.displayName}`}
                  label="Change role"
                  onPress={() => setSelectedMember(member)}
                  variant="secondary"
                />
              ) : null}
            </View>
          );
        })}
      </View>
      {canManage ? (
        <WorkspaceInvitationsSection
          isAnonymous={Boolean(data?.currentUser?.isAnonymous)}
          workspaceId={workspace.id}
        />
      ) : null}
      <WorkspaceFormSheet
        initialWorkspace={workspace}
        onClose={() => setShowEditWorkspace(false)}
        onCompleted={(updatedWorkspace) => {
          setShowEditWorkspace(false);
          void refetch();
          showToast({
            message: `${updatedWorkspace.name} was updated.`,
            tone: 'success',
          });
        }}
        visible={showEditWorkspace}
      />
      <BottomSheetModal
        description={
          selectedMember
            ? `Choose the permissions for ${selectedMember.displayName}.`
            : undefined
        }
        onClose={() => setSelectedMember(null)}
        title="Change member role"
        visible={Boolean(selectedMember)}
      >
        <View style={styles.roleOptions}>
          {editableRoles.map((role) => (
            <AppButton
              disabled={selectedMember?.role === role}
              key={role}
              label={`${role[0]}${role.slice(1).toLowerCase()}`}
              loading={roleState.loading}
              onPress={() => void changeRole(role)}
              variant="secondary"
            />
          ))}
          {roleState.error ? (
            <AppBanner
              message={roleState.error.message}
              title="Role could not be updated"
              tone="error"
            />
          ) : null}
        </View>
      </BottomSheetModal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: theme.spacing.sm },
  memberCard: {
    gap: theme.spacing.md,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
  },
  memberIdentity: { gap: theme.spacing.xs },
  memberName: { color: theme.colors.text, fontSize: 17, fontWeight: '800' },
  memberRole: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  permissionDescription: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  roleOptions: { gap: theme.spacing.sm },
  section: { gap: theme.spacing.md },
  sectionTitle: { color: theme.colors.text, fontSize: 22, fontWeight: '800' },
});
