import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@apollo/client/react';
import { useForm } from 'react-hook-form';

import {
  BOARD_QUERY,
  CREATE_TASK_MUTATION,
  UPDATE_TASK_MUTATION,
  type TaskSummary,
} from '../core/graphql';
import {
  fieldClassName,
  labelClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from '../core/form-styles';
import { taskFormSchema, type TaskFormValues } from './task-schema';

interface TaskFormProps {
  initialPosition?: number;
  onCancel: () => void;
  onCompleted: (task: TaskSummary) => void;
  projectId: string;
  statusId?: string;
  task?: TaskSummary;
}

interface TaskMutationResult {
  createTask?: TaskSummary;
  updateTask?: TaskSummary;
}

interface TaskMutationVariables {
  id?: string;
  input: {
    description: string | null;
    dueAt: string | null;
    position?: number;
    priority: TaskFormValues['priority'];
    projectId?: string;
    statusId?: string;
    title: string;
  };
}

export function TaskForm({
  initialPosition = 1000,
  onCancel,
  onCompleted,
  projectId,
  statusId,
  task,
}: TaskFormProps) {
  const editing = Boolean(task);
  const [saveTask, mutation] = useMutation<
    TaskMutationResult,
    TaskMutationVariables
  >(editing ? UPDATE_TASK_MUTATION : CREATE_TASK_MUTATION, {
    refetchQueries: [{ query: BOARD_QUERY, variables: { projectId } }],
  });
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<TaskFormValues>({
    defaultValues: {
      description: task?.description ?? '',
      dueAt: task?.dueAt ? toDateTimeLocal(task.dueAt) : '',
      priority: task?.priority ?? 'MEDIUM',
      title: task?.title ?? '',
    },
    resolver: zodResolver(taskFormSchema),
  });

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) =>
        void handleSubmit(async (values) => {
          try {
            const input: TaskMutationVariables['input'] = {
              description: values.description.trim() || null,
              dueAt: values.dueAt ? new Date(values.dueAt).toISOString() : null,
              priority: values.priority,
              title: values.title.trim(),
              ...(editing
                ? {}
                : { position: initialPosition, projectId, statusId }),
            };
            const result = await saveTask({
              variables: { input, ...(task ? { id: task.id } : {}) },
            });
            const saved = result.data?.createTask ?? result.data?.updateTask;
            if (saved) onCompleted(saved);
          } catch {
            // Apollo exposes the actionable error through mutation.error below.
          }
        })(event)
      }
    >
      <label className={labelClassName}>
        Task title
        <input autoFocus className={fieldClassName} {...register('title')} />
        {errors.title ? (
          <span className="text-xs text-rose-300">{errors.title.message}</span>
        ) : null}
      </label>
      <label className={labelClassName}>
        Description
        <textarea
          className={`${fieldClassName} min-h-28 resize-y`}
          {...register('description')}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClassName}>
          Priority
          <select className={fieldClassName} {...register('priority')}>
            <option value="NONE">None</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </label>
        <label className={labelClassName}>
          Due date and time
          <input
            className={fieldClassName}
            type="datetime-local"
            {...register('dueAt')}
          />
        </label>
      </div>
      {mutation.error ? (
        <p className="text-sm text-rose-300" role="alert">
          {mutation.error.message}
        </p>
      ) : null}
      <div className="mt-2 flex justify-end gap-3">
        <button
          className={secondaryButtonClassName}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button
          className={primaryButtonClassName}
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Saving…' : editing ? 'Save changes' : 'Create task'}
        </button>
      </div>
    </form>
  );
}

function toDateTimeLocal(value: string): string {
  const date = new Date(value);
  const localTime = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  );
  return localTime.toISOString().slice(0, 16);
}
