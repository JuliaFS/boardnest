import {
  CreateMobileTaskDocument,
  MobileBoardDocument,
  UpdateMobileTaskDocument,
  type TaskPriority,
} from '@boardnest/graphql-types';
import { useMutation } from '@apollo/client/react';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  AppBanner,
  AppButton,
  AppTextField,
  BottomSheetModal,
} from '@/components/ui';
import { theme } from '@/theme';

import { parseDueAt, taskPriorities } from './task-model';

type TaskValue = {
  description?: string | null;
  dueAt?: string | null;
  id: string;
  position: number;
  priority: TaskPriority;
  projectId: string;
  statusId: string;
  title: string;
};

type TaskFormSheetProps = {
  initialTask?: TaskValue;
  onClose: () => void;
  onCompleted: (task: TaskValue) => void;
  position?: number;
  projectId: string;
  statusId: string;
  visible: boolean;
};

export function TaskFormSheet({
  initialTask,
  onClose,
  onCompleted,
  position = 1000,
  projectId,
  statusId,
  visible,
}: TaskFormSheetProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [dueAt, setDueAt] = useState('');
  const [titleError, setTitleError] = useState<string>();
  const [dueAtError, setDueAtError] = useState<string>();
  const [createTask, creation] = useMutation(CreateMobileTaskDocument, {
    refetchQueries: [MobileBoardDocument],
  });
  const [updateTask, update] = useMutation(UpdateMobileTaskDocument, {
    refetchQueries: [MobileBoardDocument],
  });
  const state = initialTask ? update : creation;

  useEffect(() => {
    if (!visible) return;
    setTitle(initialTask?.title ?? '');
    setDescription(initialTask?.description ?? '');
    setPriority(initialTask?.priority ?? 'MEDIUM');
    setDueAt(initialTask?.dueAt ?? '');
    setTitleError(undefined);
    setDueAtError(undefined);
  }, [initialTask, visible]);

  async function submit() {
    const normalizedTitle = title.trim();
    const normalizedDueAt = parseDueAt(dueAt);
    setTitleError(normalizedTitle ? undefined : 'Enter a task title.');
    setDueAtError(
      normalizedDueAt === undefined
        ? 'Use a valid date and time, for example 2030-01-02 10:30.'
        : undefined,
    );
    if (!normalizedTitle || normalizedDueAt === undefined) return;

    const input = {
      description: description.trim() || null,
      dueAt: normalizedDueAt,
      priority,
      title: normalizedTitle,
    };
    try {
      if (initialTask) {
        const result = await updateTask({
          variables: { id: initialTask.id, input },
        });
        if (result.data) onCompleted(result.data.updateTask);
      } else {
        const result = await createTask({
          variables: {
            input: { ...input, position, projectId, statusId },
          },
        });
        if (result.data) onCompleted(result.data.createTask);
      }
    } catch {
      // Apollo exposes the actionable GraphQL error through the mutation state.
    }
  }

  return (
    <BottomSheetModal
      description="Set the task details, priority, and optional due date."
      onClose={onClose}
      title={initialTask ? 'Edit task' : 'Create task'}
      visible={visible}
    >
      <View style={styles.form}>
        <AppTextField
          autoFocus
          error={titleError}
          label="Task title"
          onChangeText={setTitle}
          value={title}
        />
        <AppTextField
          label="Description"
          multiline
          numberOfLines={4}
          onChangeText={setDescription}
          style={styles.multiline}
          value={description}
        />
        <Text style={styles.label}>Priority</Text>
        {taskPriorities.map((option) => (
          <AppButton
            key={option}
            label={option.toLowerCase()}
            onPress={() => setPriority(option)}
            variant={priority === option ? 'primary' : 'secondary'}
          />
        ))}
        <AppTextField
          autoCapitalize="none"
          error={dueAtError}
          hint="Optional. Use YYYY-MM-DD HH:mm or an ISO date."
          label="Due date and time"
          onChangeText={setDueAt}
          placeholder="2030-01-02 10:30"
          value={dueAt}
        />
        {state.error ? (
          <AppBanner
            message={state.error.message}
            title="Task could not be saved"
            tone="error"
          />
        ) : null}
        <View style={styles.actions}>
          <AppButton label="Cancel" onPress={onClose} variant="secondary" />
          <AppButton
            label={initialTask ? 'Save changes' : 'Create task'}
            loading={state.loading}
            onPress={() => void submit()}
          />
        </View>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  actions: { gap: theme.spacing.sm },
  form: { gap: theme.spacing.md },
  label: { color: theme.colors.text, fontSize: 14, fontWeight: '700' },
  multiline: { minHeight: 104, paddingTop: theme.spacing.md },
});
