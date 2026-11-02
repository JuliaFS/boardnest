import {
  MobileProjectsDocument,
  MobileWorkspacesDocument,
} from '@boardnest/graphql-types';
import { useQuery } from '@apollo/client/react';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
import {
  projectStatusLabel,
  projectVisibilityDescription,
} from '@/features/projects/project-model';
import { mobileRoutes } from '@/navigation/routes';
import { MIN_TOUCH_TARGET, theme } from '@/theme';

export default function ProjectsScreen() {
  const router = useRouter();
  const { showToast } = useFeedback();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [showWorkspacePicker, setShowWorkspacePicker] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const workspaces = useQuery(MobileWorkspacesDocument, {
    fetchPolicy: 'cache-and-network',
  });
  const workspaceNodes = workspaces.data?.workspaces.nodes ?? [];
  const activeWorkspaceId =
    workspaceNodes.find(({ id }) => id === selectedWorkspaceId)?.id ??
    workspaceNodes[0]?.id ??
    '';
  const projects = useQuery(MobileProjectsDocument, {
    fetchPolicy: 'cache-and-network',
    skip: !activeWorkspaceId,
    variables: { workspaceId: activeWorkspaceId },
  });

  useEffect(() => {
    if (!selectedWorkspaceId && workspaceNodes[0]) {
      setSelectedWorkspaceId(workspaceNodes[0].id);
    }
  }, [selectedWorkspaceId, workspaceNodes]);

  const projectNodes = projects.data?.projects.nodes ?? [];
  const currentWorkspaceRole = projects.data?.workspaceMembers.nodes.find(
    (member) => member.userId === projects.data?.currentUser?.id,
  )?.role;
  const canCreate =
    currentWorkspaceRole === 'OWNER' ||
    currentWorkspaceRole === 'ADMIN' ||
    currentWorkspaceRole === 'MEMBER';
  const guestLimitReached = Boolean(
    projects.data?.currentUser?.isAnonymous && projectNodes.length >= 1,
  );

  if (workspaces.loading && !workspaces.data) {
    return (
      <AppScreen title="Projects">
        <LoadingState title="Loading workspaces" />
      </AppScreen>
    );
  }
  if (workspaces.error && !workspaces.data) {
    return (
      <AppScreen title="Projects">
        <ErrorState
          actionLabel="Try again"
          description={workspaces.error.message}
          onAction={() => void workspaces.refetch()}
          title="Workspaces could not be loaded"
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      description="Browse the projects visible to you in each workspace."
      eyebrow="PROJECTS"
      title="Projects"
    >
      {workspaceNodes.length > 0 ? (
        <View style={styles.actions}>
          <AppButton
            label={
              workspaceNodes.find(({ id }) => id === activeWorkspaceId)?.name ??
              'Choose workspace'
            }
            onPress={() => setShowWorkspacePicker(true)}
            variant="secondary"
          />
          {canCreate ? (
            <AppButton
              disabled={guestLimitReached}
              label="Create project"
              onPress={() => setShowCreateProject(true)}
            />
          ) : null}
        </View>
      ) : null}
      {guestLimitReached ? (
        <AppBanner
          message="Guest accounts can create one project. Sign in with a registered account to create more."
          title="Project limit reached"
          tone="warning"
        />
      ) : null}
      {!activeWorkspaceId ? (
        <EmptyState
          actionLabel="Open dashboard"
          description="Create a workspace before organizing projects."
          onAction={() => router.push(mobileRoutes.dashboard)}
          title="No workspaces available"
        />
      ) : projects.loading && !projects.data ? (
        <LoadingState title="Loading projects" />
      ) : projects.error && !projects.data ? (
        <ErrorState
          actionLabel="Try again"
          description={projects.error.message}
          onAction={() => void projects.refetch()}
          title="Projects could not be loaded"
        />
      ) : projectNodes.length > 0 ? (
        <View accessibilityRole="list" style={styles.list}>
          {projectNodes.map((project) => (
            <Pressable
              accessibilityHint="Opens project details and members"
              accessibilityLabel={`${project.name}, ${projectStatusLabel(project.status)} project`}
              accessibilityRole="button"
              key={project.id}
              onPress={() => router.push(mobileRoutes.project(project.id))}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <View style={styles.cardHeading}>
                <Text style={styles.cardTitle}>{project.name}</Text>
                <Text style={styles.status}>
                  {projectStatusLabel(project.status)}
                </Text>
              </View>
              <Text numberOfLines={2} style={styles.description}>
                {project.description || 'No project description yet.'}
              </Text>
              <Text style={styles.meta}>
                {project.visibility === 'PRIVATE' ? 'Private' : 'Workspace'}
                {project.dueDate ? ` · due ${project.dueDate}` : ''}
              </Text>
              <Text style={styles.permissionHint}>
                {projectVisibilityDescription(project.visibility)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyState
          actionLabel={canCreate ? 'Create project' : undefined}
          description={
            canCreate
              ? 'Create the first project in this workspace.'
              : 'No projects are currently visible to your account.'
          }
          onAction={canCreate ? () => setShowCreateProject(true) : undefined}
          title="No projects here yet"
        />
      )}
      <BottomSheetModal
        description="Project access and lists are scoped to the selected workspace."
        onClose={() => setShowWorkspacePicker(false)}
        title="Choose workspace"
        visible={showWorkspacePicker}
      >
        <View style={styles.options}>
          {workspaceNodes.map((workspace) => (
            <AppButton
              key={workspace.id}
              label={workspace.name}
              onPress={() => {
                setSelectedWorkspaceId(workspace.id);
                setShowWorkspacePicker(false);
              }}
              variant={
                workspace.id === activeWorkspaceId ? 'primary' : 'secondary'
              }
            />
          ))}
        </View>
      </BottomSheetModal>
      {activeWorkspaceId ? (
        <ProjectFormSheet
          onClose={() => setShowCreateProject(false)}
          onCompleted={(project) => {
            setShowCreateProject(false);
            showToast({
              message: `${project.name} was created.`,
              tone: 'success',
            });
            router.push(mobileRoutes.project(project.id));
          }}
          visible={showCreateProject}
          workspaceId={activeWorkspaceId}
        />
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: theme.spacing.sm },
  card: {
    minHeight: MIN_TOUCH_TARGET,
    gap: theme.spacing.sm,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
  },
  cardHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  cardTitle: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 19,
    fontWeight: '800',
  },
  description: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 20 },
  list: { gap: theme.spacing.md },
  meta: { color: theme.colors.primary, fontSize: 13, fontWeight: '700' },
  options: { gap: theme.spacing.sm },
  permissionHint: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  pressed: { opacity: 0.72 },
  status: { color: theme.colors.primary, fontSize: 12, fontWeight: '800' },
});
