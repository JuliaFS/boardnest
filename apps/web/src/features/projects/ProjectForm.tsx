import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@apollo/client/react';
import { useForm } from 'react-hook-form';

import {
  CREATE_PROJECT_MUTATION,
  PROJECTS_QUERY,
  UPDATE_PROJECT_MUTATION,
  type ProjectSummary,
} from '../core/graphql';
import {
  fieldClassName,
  labelClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from '../core/form-styles';
import { projectFormSchema, type ProjectFormValues } from './project-schemas';

interface ProjectFormProps {
  onCancel: () => void;
  onCompleted: (project: ProjectSummary) => void;
  project?: ProjectSummary;
  workspaceId: string;
}

interface ProjectMutationResult {
  createProject?: ProjectSummary;
  updateProject?: ProjectSummary;
}

interface ProjectMutationVariables {
  id?: string;
  input: {
    description: string | null;
    dueDate: string | null;
    name: string;
    startDate: string | null;
    status: ProjectFormValues['status'];
    visibility: ProjectFormValues['visibility'];
    workspaceId?: string;
  };
}

export function ProjectForm({
  onCancel,
  onCompleted,
  project,
  workspaceId,
}: ProjectFormProps) {
  const editing = Boolean(project);
  const [saveProject, mutation] = useMutation<
    ProjectMutationResult,
    ProjectMutationVariables
  >(editing ? UPDATE_PROJECT_MUTATION : CREATE_PROJECT_MUTATION, {
    refetchQueries: [{ query: PROJECTS_QUERY, variables: { workspaceId } }],
  });
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<ProjectFormValues>({
    defaultValues: {
      description: project?.description ?? '',
      dueDate: project?.dueDate ?? '',
      name: project?.name ?? '',
      startDate: project?.startDate ?? '',
      status: project?.status ?? 'ACTIVE',
      visibility: project?.visibility ?? 'WORKSPACE',
    },
    resolver: zodResolver(projectFormSchema),
  });

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) =>
        void handleSubmit(async (values) => {
          try {
            const input: ProjectMutationVariables['input'] = {
              description: values.description.trim() || null,
              dueDate: values.dueDate || null,
              name: values.name.trim(),
              startDate: values.startDate || null,
              status: values.status,
              visibility: values.visibility,
              ...(editing ? {} : { workspaceId }),
            };
            const result = await saveProject({
              variables: { input, ...(project ? { id: project.id } : {}) },
            });
            const saved =
              result.data?.createProject ?? result.data?.updateProject;
            if (saved) onCompleted(saved);
          } catch {
            // Apollo exposes the actionable error through mutation.error below.
          }
        })(event)
      }
    >
      <label className={labelClassName}>
        Project name
        <input autoFocus className={fieldClassName} {...register('name')} />
        {errors.name ? (
          <span className="text-xs text-rose-300">{errors.name.message}</span>
        ) : null}
      </label>
      <label className={labelClassName}>
        Description
        <textarea
          className={`${fieldClassName} min-h-24 resize-y`}
          {...register('description')}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClassName}>
          Visibility
          <select className={fieldClassName} {...register('visibility')}>
            <option value="WORKSPACE">Everyone in workspace</option>
            <option value="PRIVATE">Private project</option>
          </select>
        </label>
        <label className={labelClassName}>
          Status
          <select className={fieldClassName} {...register('status')}>
            <option value="PLANNED">Planned</option>
            <option value="ACTIVE">Active</option>
            <option value="ON_HOLD">On hold</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </label>
        <label className={labelClassName}>
          Start date
          <input
            className={fieldClassName}
            type="date"
            {...register('startDate')}
          />
        </label>
        <label className={labelClassName}>
          Due date
          <input
            className={fieldClassName}
            type="date"
            {...register('dueDate')}
          />
          {errors.dueDate ? (
            <span className="text-xs text-rose-300">
              {errors.dueDate.message}
            </span>
          ) : null}
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
          {isSubmitting
            ? 'Saving…'
            : editing
              ? 'Save changes'
              : 'Create project'}
        </button>
      </div>
    </form>
  );
}
