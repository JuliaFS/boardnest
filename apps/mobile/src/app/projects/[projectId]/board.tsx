import {
  MobileBoardDocument,
  MobileProjectDetailsDocument,
  MobileProjectWorkspaceMembersDocument,
  MoveMobileTaskDocument,
  type MobileBoardQuery,
} from '@boardnest/graphql-types';
import { useMutation, useQuery } from '@apollo/client/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

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
import { TaskFormSheet } from '@/features/tasks/TaskFormSheet';
import { useProjectRealtime } from '@/features/realtime/useProjectRealtime';
import { canEditTasks } from '@/features/tasks/task-model';
import {
  groupTasksByStatus,
  moveTaskOptimistically,
  removeTaskFromColumns,
  restoreTaskColumns,
  type TaskColumns,
  upsertTaskInColumns,
} from '@/features/tasks/task-board';
import { mobileRoutes } from '@/navigation/routes';
import { theme } from '@/theme';

type Task = MobileBoardQuery['tasks']['nodes'][number];

export default function ProjectBoardScreen() {
  const router = useRouter();
  const { showToast } = useFeedback();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const board = useQuery(MobileBoardDocument, {
    skip: !projectId,
    variables: { projectId: projectId ?? '' },
  });
  const [moveTask] = useMutation(MoveMobileTaskDocument);
  const projectAccess = useQuery(MobileProjectDetailsDocument, {
    skip: !projectId,
    variables: { id: projectId ?? '' },
  });
  const workspaceId = board.data?.project?.workspaceId;
  const workspaceAccess = useQuery(MobileProjectWorkspaceMembersDocument, {
    skip: !workspaceId,
    variables: { workspaceId: workspaceId ?? '' },
  });
  const [selectedStatusId, setSelectedStatusId] = useState('');
  const [columns, setColumns] = useState<TaskColumns<Task>>({});
  const [creating, setCreating] = useState(false);
  const [movingTask, setMovingTask] = useState<Task>();
  const [moveError, setMoveError] = useState<string>();
  const statuses = useMemo(
    () =>
      [...(board.data?.taskStatuses ?? [])].sort(
        (left, right) => left.position - right.position,
      ),
    [board.data?.taskStatuses],
  );
  const currentUserId = projectAccess.data?.currentUser?.id;
  const projectRole = projectAccess.data?.projectMembers.nodes.find(
    (member) => member.userId === currentUserId,
  )?.role;
  const workspaceRole = workspaceAccess.data?.workspaceMembers.nodes.find(
    (member) => member.userId === currentUserId,
  )?.role;
  const canEdit = canEditTasks(
    workspaceRole,
    projectRole,
    board.data?.project?.visibility ?? 'PRIVATE',
  );
  const handleTaskUpsert = useCallback((task: Task) => {
    setColumns((current) => upsertTaskInColumns(current, task));
  }, []);
  const handleTaskDelete = useCallback((taskId: string) => {
    setColumns((current) => removeTaskFromColumns(current, taskId));
  }, []);
  const refreshProjectAccess = useCallback(() => {
    void Promise.all([projectAccess.refetch(), workspaceAccess.refetch()]);
  }, [projectAccess, workspaceAccess]);

  useProjectRealtime({
    onMembershipChanged: refreshProjectAccess,
    onTaskCreated: handleTaskUpsert,
    onTaskDeleted: handleTaskDelete,
    onTaskUpdated: handleTaskUpsert,
    projectId: projectId ?? '',
    skip: !board.data,
  });

  useEffect(() => {
    if (!board.data) return;
    setColumns(groupTasksByStatus(statuses, board.data.tasks.nodes));
    setSelectedStatusId((current) =>
      statuses.some((status) => status.id === current)
        ? current
        : statuses[0]?.id || '',
    );
  }, [board.data, statuses]);

  async function changeStatus(task: Task, targetStatusId: string) {
    setMoveError(undefined);
    const destination = columns[targetStatusId] ?? [];
    const position = (destination.at(-1)?.position ?? 0) + 1000;
    const optimistic = moveTaskOptimistically(
      columns,
      task.id,
      targetStatusId,
      position,
    );
    setColumns(optimistic.next);
    setMovingTask(undefined);
    try {
      await moveTask({
        variables: {
          id: task.id,
          input: { position, statusId: targetStatusId },
        },
      });
      showToast({ message: 'Task status updated.', tone: 'success' });
    } catch (error) {
      setColumns(restoreTaskColumns(optimistic.before));
      setMoveError(
        error instanceof Error ? error.message : 'Task movement failed.',
      );
      await board.refetch();
    }
  }

  if (board.loading && !board.data) {
    return (
      <AppScreen title="Board">
        <LoadingState title="Loading tasks" />
      </AppScreen>
    );
  }
  if (board.error && !board.data) {
    return (
      <AppScreen title="Board">
        <ErrorState
          actionLabel="Try again"
          description={board.error.message}
          onAction={() => void board.refetch()}
          title="Board could not be loaded"
        />
      </AppScreen>
    );
  }

  const project = board.data?.project;
  const selectedTasks = columns[selectedStatusId] ?? [];
  const selectedStatus = statuses.find(
    (status) => status.id === selectedStatusId,
  );

  return (
    <AppScreen
      description="Browse one column at a time and move tasks through an accessible status menu."
      eyebrow="KANBAN"
      title={project?.name ?? 'Project board'}
    >
      <View style={styles.actions}>
        <AppButton label="Back" onPress={() => router.back()} variant="ghost" />
        {canEdit ? (
          <AppButton
            disabled={!selectedStatusId}
            label="Create task"
            onPress={() => setCreating(true)}
          />
        ) : null}
      </View>
      {moveError ? (
        <AppBanner
          message={`${moveError} The previous board state was restored.`}
          title="Task could not be moved"
          tone="error"
        />
      ) : null}
      <ScrollView
        accessibilityLabel="Board columns"
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <View style={styles.tabs}>
          {statuses.map((status) => (
            <AppButton
              key={status.id}
              accessibilityLabel={`${status.name}, ${(columns[status.id] ?? []).length} tasks`}
              label={`${status.name} (${(columns[status.id] ?? []).length})`}
              onPress={() => setSelectedStatusId(status.id)}
              variant={status.id === selectedStatusId ? 'primary' : 'secondary'}
            />
          ))}
        </View>
      </ScrollView>
      {statuses.length === 0 ? (
        <EmptyState
          description="This project does not have task statuses yet."
          title="No board columns"
        />
      ) : selectedTasks.length === 0 ? (
        <EmptyState
          actionLabel={canEdit ? 'Create task' : undefined}
          description={`Add the first task to ${selectedStatus?.name ?? 'this column'}.`}
          onAction={canEdit ? () => setCreating(true) : undefined}
          title="Column is empty"
        />
      ) : (
        <View style={styles.list}>
          {selectedTasks.map((task) => (
            <View key={task.id} style={styles.card}>
              <Text style={styles.cardTitle}>{task.title}</Text>
              <Text style={styles.meta}>
                {task.priority.toLowerCase()} priority
                {task.dueAt
                  ? ` · Due ${new Date(task.dueAt).toLocaleString()}`
                  : ''}
              </Text>
              <AppButton
                accessibilityLabel={`Open ${task.title}`}
                label="Open task"
                onPress={() =>
                  router.push(mobileRoutes.task(task.projectId, task.id))
                }
                variant="secondary"
              />
              {canEdit ? (
                <AppButton
                  label="Change status"
                  onPress={() => setMovingTask(task)}
                  variant="secondary"
                />
              ) : null}
            </View>
          ))}
        </View>
      )}
      <TaskFormSheet
        onClose={() => setCreating(false)}
        onCompleted={() => {
          setCreating(false);
          void board.refetch();
          showToast({ message: 'Task created.', tone: 'success' });
        }}
        position={(selectedTasks.at(-1)?.position ?? 0) + 1000}
        projectId={projectId ?? ''}
        statusId={selectedStatusId}
        visible={creating}
      />
      <BottomSheetModal
        description={
          movingTask
            ? `Move “${movingTask.title}” to another column.`
            : undefined
        }
        onClose={() => setMovingTask(undefined)}
        title="Change task status"
        visible={Boolean(movingTask)}
      >
        {statuses.map((status) => (
          <AppButton
            disabled={movingTask?.statusId === status.id}
            key={status.id}
            label={status.name}
            onPress={() => {
              if (movingTask) void changeStatus(movingTask, status.id);
            }}
            variant="secondary"
          />
        ))}
      </BottomSheetModal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: theme.spacing.sm },
  card: {
    gap: theme.spacing.md,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
  },
  cardTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '800' },
  list: { gap: theme.spacing.md },
  meta: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 19 },
  tabs: { flexDirection: 'row', gap: theme.spacing.sm },
});
