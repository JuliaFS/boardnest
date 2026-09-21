import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@apollo/client/react';
import { useRef } from 'react';
import { useForm } from 'react-hook-form';

import {
  CREATE_WORKSPACE_MUTATION,
  WORKSPACES_QUERY,
  type WorkspaceSummary,
} from '../core/graphql';
import {
  fieldClassName,
  labelClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from '../core/form-styles';
import {
  workspaceFormSchema,
  workspaceSlugFromName,
  type WorkspaceFormValues,
} from './project-schemas';

interface WorkspaceFormProps {
  onCancel: () => void;
  onCompleted: (workspace: WorkspaceSummary) => void;
}

interface CreateWorkspaceResult {
  createWorkspace: WorkspaceSummary;
}

export function WorkspaceForm({ onCancel, onCompleted }: WorkspaceFormProps) {
  const slugWasEdited = useRef(false);
  const [createWorkspace, mutation] = useMutation<
    CreateWorkspaceResult,
    { input: WorkspaceFormValues }
  >(CREATE_WORKSPACE_MUTATION, { refetchQueries: [WORKSPACES_QUERY] });
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setValue,
  } = useForm<WorkspaceFormValues>({
    defaultValues: { name: '', slug: '' },
    resolver: zodResolver(workspaceFormSchema),
  });
  const nameField = register('name');
  const slugField = register('slug');

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) =>
        void handleSubmit(async (input) => {
          try {
            const result = await createWorkspace({ variables: { input } });
            if (result.data) onCompleted(result.data.createWorkspace);
          } catch {
            // Apollo exposes the actionable error through mutation.error below.
          }
        })(event)
      }
    >
      <label className={labelClassName}>
        Workspace name
        <input
          autoFocus
          className={fieldClassName}
          {...nameField}
          onChange={(event) => {
            void nameField.onChange(event);
            if (!slugWasEdited.current) {
              setValue('slug', workspaceSlugFromName(event.target.value), {
                shouldValidate: false,
              });
            }
          }}
        />
        {errors.name ? (
          <span className="text-xs text-rose-300">{errors.name.message}</span>
        ) : null}
      </label>
      <label className={labelClassName}>
        URL slug
        <input
          className={fieldClassName}
          placeholder="product-team"
          {...slugField}
          onChange={(event) => {
            slugWasEdited.current = true;
            void slugField.onChange(event);
          }}
        />
        {errors.slug ? (
          <span className="text-xs text-rose-300">{errors.slug.message}</span>
        ) : (
          <span className="text-xs font-normal text-slate-500">
            Generated from the name. You can edit it using lowercase letters,
            numbers, and hyphens.
          </span>
        )}
      </label>
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
          {isSubmitting ? 'Creating…' : 'Create workspace'}
        </button>
      </div>
    </form>
  );
}
