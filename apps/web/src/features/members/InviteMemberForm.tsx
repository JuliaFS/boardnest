import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@apollo/client/react';
import { useForm } from 'react-hook-form';

import {
  INVITE_MEMBER_MUTATION,
  WORKSPACE_INVITATIONS_QUERY,
  type InvitationSummary,
} from '../core/graphql';
import {
  fieldClassName,
  labelClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from '../core/form-styles';
import { inviteMemberSchema, type InviteMemberValues } from './member-schemas';

interface InviteMemberFormProps {
  onCancel: () => void;
  onCompleted: (result: {
    invitation: InvitationSummary;
    token: string;
  }) => void;
  workspaceId: string;
}

interface InviteMemberResult {
  inviteMember: {
    invitation: InvitationSummary;
    token: string;
  };
}

export function InviteMemberForm({
  onCancel,
  onCompleted,
  workspaceId,
}: InviteMemberFormProps) {
  const [inviteMember, mutation] = useMutation<
    InviteMemberResult,
    { input: InviteMemberValues & { workspaceId: string } }
  >(INVITE_MEMBER_MUTATION, {
    refetchQueries: [WORKSPACE_INVITATIONS_QUERY],
  });
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<InviteMemberValues>({
    defaultValues: { email: '', role: 'MEMBER' },
    resolver: zodResolver(inviteMemberSchema),
  });

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) =>
        void handleSubmit(async (input) => {
          try {
            const result = await inviteMember({
              variables: { input: { ...input, workspaceId } },
            });
            if (result.data) onCompleted(result.data.inviteMember);
          } catch {
            // Apollo exposes the actionable error through mutation.error.
          }
        })(event)
      }
    >
      <label className={labelClassName}>
        Email address
        <input
          autoComplete="email"
          autoFocus
          className={fieldClassName}
          placeholder="member@example.com"
          type="email"
          {...register('email')}
        />
        {errors.email ? (
          <span className="text-xs text-rose-300">{errors.email.message}</span>
        ) : null}
      </label>
      <label className={labelClassName}>
        Workspace role
        <select className={fieldClassName} {...register('role')}>
          <option value="MEMBER">Member — create and edit work</option>
          <option value="VIEWER">Viewer — read only</option>
          <option value="ADMIN">Admin — manage workspace and members</option>
        </select>
        <span className="text-xs font-normal leading-5 text-slate-500">
          Owner access cannot be granted through an invitation.
        </span>
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
          {isSubmitting ? 'Sending…' : 'Create invitation'}
        </button>
      </div>
    </form>
  );
}
