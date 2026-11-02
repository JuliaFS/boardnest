import {
  AddMobileProjectMemberDocument,
  MobileProjectDetailsDocument,
  MobileProjectWorkspaceMembersDocument,
  RemoveMobileProjectMemberDocument,
  UpdateMobileProjectMemberRoleDocument,
  type MobileProjectDetailsQuery,
  type ProjectRole,
  type WorkspaceRole,
} from '@boardnest/graphql-types';
import { useMutation, useQuery } from '@apollo/client/react';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  AppBanner,
  AppButton,
  BottomSheetModal,
  ErrorState,
  LoadingState,
} from '@/components/ui';
import { theme } from '@/theme';

import { canManageProject, projectRoleDescription } from './project-model';

type ProjectMember =
  MobileProjectDetailsQuery['projectMembers']['nodes'][number];
type WorkspaceMember = {
  displayName: string;
  role: WorkspaceRole;
  userId: string;
};

const roles: ProjectRole[] = ['PROJECT_LEAD', 'MEMBER', 'VIEWER'];

export function ProjectMembersSection({
  currentUserId,
  members,
  projectId,
  workspaceId,
  workspaceRole,
}: {
  currentUserId?: string;
  members: ProjectMember[];
  projectId: string;
  workspaceId: string;
  workspaceRole?: WorkspaceRole;
}) {
  const [addingMember, setAddingMember] = useState(false);
  const [selectedWorkspaceMember, setSelectedWorkspaceMember] =
    useState<WorkspaceMember | null>(null);
  const [selectedMember, setSelectedMember] = useState<ProjectMember | null>(
    null,
  );
  const [removingMember, setRemovingMember] = useState<ProjectMember | null>(
    null,
  );
  const workspaceMembers = useQuery(MobileProjectWorkspaceMembersDocument, {
    variables: { workspaceId },
  });
  const [addMember, addState] = useMutation(AddMobileProjectMemberDocument);
  const [updateRole, updateState] = useMutation(
    UpdateMobileProjectMemberRoleDocument,
  );
  const [removeMember, removeState] = useMutation(
    RemoveMobileProjectMemberDocument,
  );
  const currentProjectRole = members.find(
    (member) => member.userId === currentUserId,
  )?.role;
  const canManage = canManageProject(workspaceRole, currentProjectRole);
  const assignedIds = new Set(members.map((member) => member.userId));
  const availableMembers = (
    workspaceMembers.data?.workspaceMembers.nodes ?? []
  ).filter((member) => !assignedIds.has(member.userId));
  const error = addState.error ?? updateState.error ?? removeState.error;
  const refetchQueries = [
    { query: MobileProjectDetailsDocument, variables: { id: projectId } },
  ];

  async function addSelected(role: ProjectRole) {
    if (!selectedWorkspaceMember) return;
    try {
      await addMember({
        refetchQueries,
        variables: {
          projectId,
          role,
          userId: selectedWorkspaceMember.userId,
        },
      });
      setSelectedWorkspaceMember(null);
      setAddingMember(false);
    } catch {
      // Apollo exposes the actionable error through addState.
    }
  }

  async function changeRole(role: ProjectRole) {
    if (!selectedMember) return;
    try {
      await updateRole({
        refetchQueries,
        variables: { projectId, role, userId: selectedMember.userId },
      });
      setSelectedMember(null);
    } catch {
      // Apollo exposes the actionable error through updateState.
    }
  }

  async function confirmRemove() {
    if (!removingMember) return;
    try {
      await removeMember({
        refetchQueries,
        variables: { projectId, userId: removingMember.userId },
      });
      setRemovingMember(null);
    } catch {
      // Apollo exposes the actionable error through removeState.
    }
  }

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View style={styles.headingText}>
          <Text accessibilityRole="header" style={styles.heading}>
            Project members ({members.length})
          </Text>
          <Text style={styles.help}>
            Project roles cannot elevate a workspace viewer's permissions.
          </Text>
        </View>
        {canManage ? (
          <AppButton
            label="Add member"
            onPress={() => setAddingMember(true)}
            variant="secondary"
          />
        ) : null}
      </View>
      {workspaceMembers.loading && !workspaceMembers.data ? (
        <LoadingState title="Loading members" />
      ) : workspaceMembers.error && !workspaceMembers.data ? (
        <ErrorState
          actionLabel="Try again"
          description={workspaceMembers.error.message}
          onAction={() => void workspaceMembers.refetch()}
          title="Members could not be loaded"
        />
      ) : null}
      {error ? (
        <AppBanner
          message={error.message}
          title="Member action failed"
          tone="error"
        />
      ) : null}
      {members.length > 0 ? (
        <View style={styles.memberList}>
          {members.map((member) => {
            const canEdit = canManage && member.userId !== currentUserId;
            return (
              <View key={member.userId} style={styles.memberCard}>
                <View style={styles.memberHeading}>
                  <Text style={styles.memberName}>
                    {member.displayName}
                    {member.userId === currentUserId ? ' · you' : ''}
                  </Text>
                  <Text style={styles.role}>{roleLabel(member.role)}</Text>
                </View>
                <Text style={styles.help}>
                  {projectRoleDescription(member.role)}
                </Text>
                {canEdit ? (
                  <View style={styles.memberActions}>
                    <AppButton
                      label="Change role"
                      onPress={() => setSelectedMember(member)}
                      variant="secondary"
                    />
                    <AppButton
                      label="Remove"
                      onPress={() => setRemovingMember(member)}
                      variant="danger"
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={styles.empty}>No explicit project members yet.</Text>
      )}
      <BottomSheetModal
        description="Choose a workspace member, then assign a project role."
        onClose={() => {
          setAddingMember(false);
          setSelectedWorkspaceMember(null);
        }}
        title="Add project member"
        visible={addingMember}
      >
        <View style={styles.options}>
          {availableMembers.length > 0 ? (
            availableMembers.map((member) => (
              <AppButton
                key={member.userId}
                label={`${member.displayName} · ${roleLabel(member.role)}`}
                onPress={() => setSelectedWorkspaceMember(member)}
                variant={
                  selectedWorkspaceMember?.userId === member.userId
                    ? 'primary'
                    : 'secondary'
                }
              />
            ))
          ) : (
            <Text style={styles.empty}>
              Every workspace member is already assigned.
            </Text>
          )}
          {selectedWorkspaceMember ? (
            <View style={styles.options}>
              <Text style={styles.help}>Assign a role</Text>
              {roles.map((role) => (
                <AppButton
                  key={role}
                  label={roleLabel(role)}
                  loading={addState.loading}
                  onPress={() => void addSelected(role)}
                  variant="secondary"
                />
              ))}
            </View>
          ) : null}
        </View>
      </BottomSheetModal>
      <BottomSheetModal
        description={
          selectedMember
            ? `Choose permissions for ${selectedMember.displayName}.`
            : undefined
        }
        onClose={() => setSelectedMember(null)}
        title="Change project role"
        visible={Boolean(selectedMember)}
      >
        <View style={styles.options}>
          {roles.map((role) => (
            <AppButton
              disabled={selectedMember?.role === role}
              key={role}
              label={roleLabel(role)}
              loading={updateState.loading}
              onPress={() => void changeRole(role)}
              variant="secondary"
            />
          ))}
        </View>
      </BottomSheetModal>
      <BottomSheetModal
        description={
          removingMember
            ? `Remove ${removingMember.displayName} from this project? Their workspace membership remains unchanged.`
            : undefined
        }
        onClose={() => setRemovingMember(null)}
        title="Remove project member"
        visible={Boolean(removingMember)}
      >
        <View style={styles.options}>
          <AppButton
            label="Cancel"
            onPress={() => setRemovingMember(null)}
            variant="secondary"
          />
          <AppButton
            label="Remove member"
            loading={removeState.loading}
            onPress={() => void confirmRemove()}
            variant="danger"
          />
        </View>
      </BottomSheetModal>
    </View>
  );
}

function roleLabel(role: string): string {
  return role
    .toLowerCase()
    .split('_')
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

const styles = StyleSheet.create({
  empty: {
    color: theme.colors.textMuted,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    padding: theme.spacing.lg,
    textAlign: 'center',
  },
  heading: { color: theme.colors.text, fontSize: 20, fontWeight: '800' },
  headingRow: { gap: theme.spacing.md },
  headingText: { gap: theme.spacing.xs },
  help: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 19 },
  memberActions: { gap: theme.spacing.sm },
  memberCard: {
    gap: theme.spacing.md,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
  },
  memberHeading: { gap: theme.spacing.xs },
  memberList: { gap: theme.spacing.md },
  memberName: { color: theme.colors.text, fontSize: 16, fontWeight: '800' },
  options: { gap: theme.spacing.sm },
  role: { color: theme.colors.primary, fontSize: 12, fontWeight: '800' },
  section: { gap: theme.spacing.lg },
});
