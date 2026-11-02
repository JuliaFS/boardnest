import {
  AddMobileTaskCommentDocument,
  AssignMobileTaskDocument,
  DeleteMobileTaskDocument,
  MobileBoardDocument,
  MobileProjectWorkspaceMembersDocument,
  MobileTaskDetailsDocument,
  UnassignMobileTaskDocument,
} from '@boardnest/graphql-types';
import { useMutation, useQuery } from '@apollo/client/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  AppBanner,
  AppButton,
  AppScreen,
  AppTextField,
  BottomSheetModal,
  EmptyState,
  ErrorState,
  LoadingState,
  useFeedback,
} from '@/components/ui';
import { TaskFormSheet } from '@/features/tasks/TaskFormSheet';
import { canEditTasks } from '@/features/tasks/task-model';
import { mobileRoutes } from '@/navigation/routes';
import { theme } from '@/theme';

export default function TaskDetailsScreen() {
  const router = useRouter();
  const { showToast } = useFeedback();
  const { projectId, taskId } = useLocalSearchParams<{
    projectId: string;
    taskId: string;
  }>();
  const details = useQuery(MobileTaskDetailsDocument, {
    skip: !projectId || !taskId,
    variables: { id: taskId ?? '', projectId: projectId ?? '' },
  });
  const workspaceId = details.data?.project?.workspaceId;
  const workspaceMembers = useQuery(MobileProjectWorkspaceMembersDocument, {
    skip: !workspaceId,
    variables: { workspaceId: workspaceId ?? '' },
  });
  const [assignTask, assignment] = useMutation(AssignMobileTaskDocument);
  const [unassignTask, unassignment] = useMutation(UnassignMobileTaskDocument);
  const [addComment, commentState] = useMutation(AddMobileTaskCommentDocument);
  const [deleteTask, deletion] = useMutation(DeleteMobileTaskDocument);
  const [editing, setEditing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [comment, setComment] = useState('');

  const data = details.data;
  const task = data?.task;
  const project = data?.project;
  const currentUserId = data?.currentUser?.id;
  const members = workspaceMembers.data?.workspaceMembers.nodes ?? [];
  const memberNames = new Map(
    members.map((member) => [
      member.userId,
      member.displayName ?? member.userId,
    ]),
  );
  const projectRole = data?.projectMembers.nodes.find(
    (member) => member.userId === currentUserId,
  )?.role;
  const workspaceRole = members.find(
    (member) => member.userId === currentUserId,
  )?.role;
  const canEdit = canEditTasks(
    workspaceRole,
    projectRole,
    project?.visibility ?? 'PRIVATE',
  );
  const assigneeIds = new Set(data?.taskAssignees.map((item) => item.userId));
  const eligibleMembers = members.filter(
    (member) =>
      member.role !== 'VIEWER' &&
      (project?.visibility === 'WORKSPACE' ||
        data?.projectMembers.nodes.some(
          (projectMember) =>
            projectMember.userId === member.userId &&
            projectMember.role !== 'VIEWER',
        )),
  );

  async function refresh() {
    await Promise.all([details.refetch(), workspaceMembers.refetch()]);
  }

  async function saveAssignment(userId: string, assigned: boolean) {
    try {
      if (assigned) {
        await unassignTask({
          variables: { assigneeId: userId, taskId: taskId ?? '' },
        });
      } else {
        await assignTask({
          variables: { assigneeId: userId, taskId: taskId ?? '' },
        });
      }
      await refresh();
      showToast({ message: 'Task assignments updated.', tone: 'success' });
    } catch {
      // The active mutation exposes its GraphQL error below.
    }
  }

  async function submitComment() {
    const body = comment.trim();
    if (!body) return;
    try {
      await addComment({ variables: { body, taskId: taskId ?? '' } });
      setComment('');
      await details.refetch();
      showToast({ message: 'Comment added.', tone: 'success' });
    } catch {
      // Apollo exposes the GraphQL error through commentState.
    }
  }

  async function removeTask() {
    if (!task || !projectId) return;
    try {
      await deleteTask({
        refetchQueries: [MobileBoardDocument],
        variables: { id: task.id },
      });
      showToast({ message: 'Task deleted.', tone: 'success' });
      router.replace(mobileRoutes.board(projectId));
    } catch {
      // Apollo exposes the GraphQL error through deletion.
    }
  }

  if (details.loading && !details.data) {
    return (
      <AppScreen title="Task">
        <LoadingState title="Loading task" />
      </AppScreen>
    );
  }
  if (details.error && !details.data) {
    return (
      <AppScreen title="Task">
        <ErrorState
          actionLabel="Try again"
          description={details.error.message}
          onAction={() => void details.refetch()}
          title="Task could not be loaded"
        />
      </AppScreen>
    );
  }
  if (!task || !project) {
    return (
      <AppScreen title="Task">
        <EmptyState
          actionLabel="Go back"
          description="The task was removed or you no longer have access."
          onAction={() => router.back()}
          title="Task unavailable"
        />
      </AppScreen>
    );
  }

  const status = data.taskStatuses.find((item) => item.id === task.statusId);
  return (
    <AppScreen
      description={task.description || 'No task description yet.'}
      eyebrow={project.name}
      title={task.title}
    >
      <View style={styles.actions}>
        <AppButton label="Back" onPress={() => router.back()} variant="ghost" />
        {canEdit ? (
          <AppButton
            label="Edit task"
            onPress={() => setEditing(true)}
            variant="secondary"
          />
        ) : null}
      </View>
      <View style={styles.panel}>
        <Fact label="Status" value={status?.name ?? 'Unknown'} />
        <Fact label="Priority" value={task.priority.toLowerCase()} />
        <Fact
          label="Due"
          value={task.dueAt ? new Date(task.dueAt).toLocaleString() : 'Not set'}
        />
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Assignees
        </Text>
        {data.taskAssignees.length === 0 ? (
          <Text style={styles.muted}>No one is assigned yet.</Text>
        ) : (
          data.taskAssignees.map((assignee) => (
            <Text key={assignee.userId} style={styles.text}>
              {memberNames.get(assignee.userId) ?? assignee.userId}
            </Text>
          ))
        )}
        {canEdit ? (
          <AppButton
            label="Manage assignees"
            onPress={() => setAssigning(true)}
            variant="secondary"
          />
        ) : null}
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Comments
        </Text>
        {data.taskComments.nodes.length === 0 ? (
          <Text style={styles.muted}>No comments yet.</Text>
        ) : (
          data.taskComments.nodes.map((item) => (
            <View key={item.id} style={styles.comment}>
              <Text style={styles.text}>{item.body}</Text>
              <Text style={styles.muted}>
                {item.authorId
                  ? (memberNames.get(item.authorId) ?? 'Member')
                  : 'Former member'}{' '}
                · {new Date(item.createdAt).toLocaleString()}
              </Text>
            </View>
          ))
        )}
        <AppTextField
          label="Add comment"
          multiline
          onChangeText={setComment}
          value={comment}
        />
        {commentState.error ? (
          <AppBanner
            message={commentState.error.message}
            title="Comment could not be added"
            tone="error"
          />
        ) : null}
        <AppButton
          disabled={!comment.trim()}
          label="Post comment"
          loading={commentState.loading}
          onPress={() => void submitComment()}
        />
      </View>
      {canEdit ? (
        <View style={styles.dangerZone}>
          <Text accessibilityRole="header" style={styles.dangerTitle}>
            Delete task
          </Text>
          <Text style={styles.muted}>
            This permanently removes the task, assignments, comments, and
            reminders.
          </Text>
          <AppButton
            label="Delete task"
            onPress={() => setConfirmingDelete(true)}
            variant="danger"
          />
        </View>
      ) : null}
      <TaskFormSheet
        initialTask={task}
        onClose={() => setEditing(false)}
        onCompleted={() => {
          setEditing(false);
          void details.refetch();
          showToast({ message: 'Task updated.', tone: 'success' });
        }}
        projectId={project.id}
        statusId={task.statusId}
        visible={editing}
      />
      <BottomSheetModal
        description="Select the project contributors responsible for this task."
        onClose={() => setAssigning(false)}
        title="Manage assignees"
        visible={assigning}
      >
        {assignment.error || unassignment.error ? (
          <AppBanner
            message={
              (assignment.error ?? unassignment.error)?.message ??
              'Assignment failed.'
            }
            title="Assignees could not be updated"
            tone="error"
          />
        ) : null}
        {eligibleMembers.map((member) => {
          const assigned = assigneeIds.has(member.userId);
          return (
            <AppButton
              key={member.userId}
              label={`${assigned ? 'Remove' : 'Assign'} ${member.displayName ?? member.userId}`}
              loading={assignment.loading || unassignment.loading}
              onPress={() => void saveAssignment(member.userId, assigned)}
              variant="secondary"
            />
          );
        })}
      </BottomSheetModal>
      <BottomSheetModal
        description={`Permanently delete “${task.title}”?`}
        onClose={() => setConfirmingDelete(false)}
        title="Delete task"
        visible={confirmingDelete}
      >
        {deletion.error ? (
          <AppBanner
            message={deletion.error.message}
            title="Task could not be deleted"
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
          onPress={() => void removeTask()}
          variant="danger"
        />
      </BottomSheetModal>
    </AppScreen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.text}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: theme.spacing.sm },
  comment: {
    gap: theme.spacing.xs,
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    paddingTop: theme.spacing.md,
  },
  dangerTitle: { color: theme.colors.danger, fontSize: 18, fontWeight: '800' },
  dangerZone: {
    gap: theme.spacing.md,
    borderColor: theme.colors.danger,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    padding: theme.spacing.lg,
  },
  fact: { flex: 1, gap: theme.spacing.xs },
  muted: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 19 },
  panel: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
  },
  section: { gap: theme.spacing.md },
  sectionTitle: { color: theme.colors.text, fontSize: 20, fontWeight: '800' },
  text: { color: theme.colors.text, fontSize: 15, lineHeight: 21 },
});
