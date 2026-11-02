import {
  DeleteMobileProjectDocument,
  MobileProjectDetailsDocument,
  MobileProjectWorkspaceMembersDocument,
  MobileProjectsDocument,
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
import { ProjectFormSheet } from '@/features/projects/ProjectFormSheet';
import { ProjectMembersSection } from '@/features/projects/ProjectMembersSection';
import {
  canManageProject,
  projectStatusLabel,
  projectVisibilityDescription,
} from '@/features/projects/project-model';
import { mobileRoutes } from '@/navigation/routes';
import { theme } from '@/theme';

export default function ProjectDetailsScreen() {
  const router = useRouter();
  const { showToast } = useFeedback();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const details = useQuery(MobileProjectDetailsDocument, {
    skip: !projectId,
    variables: { id: projectId ?? '' },
  });
  const project = details.data?.project;
  const workspaceMembers = useQuery(MobileProjectWorkspaceMembersDocument, {
    skip: !project?.workspaceId,
    variables: { workspaceId: project?.workspaceId ?? '' },
  });
  const [deleteProject, deletion] = useMutation(DeleteMobileProjectDocument);
  const members = details.data?.projectMembers.nodes ?? [];
  const currentUserId = details.data?.currentUser?.id;
  const workspaceRole = workspaceMembers.data?.workspaceMembers.nodes.find(
    (member) => member.userId === currentUserId,
  )?.role;
  const projectRole = members.find(
    (member) => member.userId === currentUserId,
  )?.role;
  const canManage = canManageProject(workspaceRole, projectRole);
  const canDelete = workspaceRole === 'OWNER' || workspaceRole === 'ADMIN';

  async function confirmDelete() {
    if (!project) return;
    try {
      await deleteProject({
        refetchQueries: [
          {
            query: MobileProjectsDocument,
            variables: { workspaceId: project.workspaceId },
          },
        ],
        variables: { id: project.id },
      });
      showToast({ message: `${project.name} was deleted.`, tone: 'success' });
      router.replace(mobileRoutes.projects);
    } catch {
      // Apollo exposes the actionable GraphQL error through deletion.
    }
  }

  if (details.loading && !details.data) {
    return (
      <AppScreen title="Project">
        <LoadingState title="Loading project" />
      </AppScreen>
    );
  }
  if (details.error && !details.data) {
    return (
      <AppScreen title="Project">
        <ErrorState
          actionLabel="Try again"
          description={details.error.message}
          onAction={() => void details.refetch()}
          title="Project could not be loaded"
        />
      </AppScreen>
    );
  }
  if (!project) {
    return (
      <AppScreen title="Project">
        <EmptyState
          actionLabel="Go back"
          description="The project was removed or your account no longer has access."
          onAction={() => router.back()}
          title="Project unavailable"
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      description={project.description || 'No project description yet.'}
      eyebrow="PROJECT"
      title={project.name}
    >
      <View style={styles.actions}>
        <AppButton label="Back" onPress={() => router.back()} variant="ghost" />
        <AppButton
          label="Open task board"
          onPress={() => router.push(mobileRoutes.board(project.id))}
        />
        {canManage ? (
          <AppButton
            label="Edit project"
            onPress={() => setEditing(true)}
            variant="secondary"
          />
        ) : null}
      </View>
      <View style={styles.facts}>
        <ProjectFact
          label="Status"
          value={projectStatusLabel(project.status)}
        />
        <ProjectFact
          label="Visibility"
          value={project.visibility === 'PRIVATE' ? 'Private' : 'Workspace'}
        />
        <ProjectFact
          label="Start date"
          value={project.startDate ?? 'Not set'}
        />
        <ProjectFact label="Due date" value={project.dueDate ?? 'Not set'} />
      </View>
      <AppBanner
        message={projectVisibilityDescription(project.visibility)}
        title={`${project.visibility === 'PRIVATE' ? 'Private' : 'Workspace'} visibility`}
        tone="info"
      />
      {workspaceMembers.error && !workspaceMembers.data ? (
        <ErrorState
          actionLabel="Try again"
          description={workspaceMembers.error.message}
          onAction={() => void workspaceMembers.refetch()}
          title="Permissions could not be loaded"
        />
      ) : (
        <ProjectMembersSection
          currentUserId={currentUserId}
          members={members}
          projectId={project.id}
          workspaceId={project.workspaceId}
          workspaceRole={workspaceRole}
        />
      )}
      {canDelete ? (
        <View style={styles.dangerZone}>
          <Text accessibilityRole="header" style={styles.dangerTitle}>
            Danger zone
          </Text>
          <Text style={styles.dangerDescription}>
            Deleting this project permanently removes its tasks, statuses, and
            project memberships.
          </Text>
          <AppButton
            label="Delete project"
            onPress={() => setConfirmingDelete(true)}
            variant="danger"
          />
        </View>
      ) : null}
      <ProjectFormSheet
        initialProject={project}
        onClose={() => setEditing(false)}
        onCompleted={(updatedProject) => {
          setEditing(false);
          void details.refetch();
          showToast({
            message: `${updatedProject.name} was updated.`,
            tone: 'success',
          });
        }}
        visible={editing}
        workspaceId={project.workspaceId}
      />
      <BottomSheetModal
        description={`Permanently delete “${project.name}” and all related project data?`}
        onClose={() => setConfirmingDelete(false)}
        title="Delete project"
        visible={confirmingDelete}
      >
        <View style={styles.actions}>
          {deletion.error ? (
            <AppBanner
              message={deletion.error.message}
              title="Project could not be deleted"
              tone="error"
            />
          ) : null}
          <AppButton
            label="Cancel"
            onPress={() => setConfirmingDelete(false)}
            variant="secondary"
          />
          <AppButton
            label="Delete permanently"
            loading={deletion.loading}
            onPress={() => void confirmDelete()}
            variant="danger"
          />
        </View>
      </BottomSheetModal>
    </AppScreen>
  );
}

function ProjectFact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: theme.spacing.sm },
  dangerDescription: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  dangerTitle: { color: theme.colors.danger, fontSize: 18, fontWeight: '800' },
  dangerZone: {
    gap: theme.spacing.md,
    borderColor: theme.colors.danger,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    padding: theme.spacing.lg,
  },
  fact: {
    gap: theme.spacing.xs,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
  },
  factLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  factValue: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
  facts: { gap: theme.spacing.sm },
});
