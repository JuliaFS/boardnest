import { useMutation, useQuery } from '@apollo/client/react';
import { useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import {
  ADD_PROJECT_MEMBER_MUTATION,
  PROJECT_MEMBERS_QUERY,
  REMOVE_PROJECT_MEMBER_MUTATION,
  UPDATE_PROJECT_MEMBER_ROLE_MUTATION,
  WORKSPACE_MEMBERS_QUERY,
  type ProjectMembersData,
  type ProjectRole,
  type WorkspaceMembersData,
} from '../core/graphql';
import { PageSkeleton, QueryError } from '../core/QueryState';
import { primaryButtonClassName } from '../core/form-styles';

const editableRoles: ProjectRole[] = ['PROJECT_LEAD', 'MEMBER', 'VIEWER'];

export function ProjectMembersSection({
  projectId,
  visibility,
  workspaceId,
}: {
  projectId: string;
  visibility: 'PRIVATE' | 'WORKSPACE';
  workspaceId: string;
}) {
  const { user } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<ProjectRole>('MEMBER');
  const [actionError, setActionError] = useState<string | null>(null);
  const projectMembers = useQuery<ProjectMembersData>(PROJECT_MEMBERS_QUERY, {
    variables: { projectId },
  });
  const workspaceMembers = useQuery<WorkspaceMembersData>(
    WORKSPACE_MEMBERS_QUERY,
    { variables: { workspaceId } },
  );
  const [addProjectMember, addState] = useMutation(
    ADD_PROJECT_MEMBER_MUTATION,
    { refetchQueries: [PROJECT_MEMBERS_QUERY] },
  );
  const [updateProjectMemberRole, updateState] = useMutation(
    UPDATE_PROJECT_MEMBER_ROLE_MUTATION,
    { refetchQueries: [PROJECT_MEMBERS_QUERY] },
  );
  const [removeProjectMember, removeState] = useMutation(
    REMOVE_PROJECT_MEMBER_MUTATION,
    { refetchQueries: [PROJECT_MEMBERS_QUERY] },
  );

  if (projectMembers.loading || workspaceMembers.loading) {
    return (
      <section className="mt-10" aria-labelledby="project-members-heading">
        <SectionHeading visibility={visibility} />
        <div className="mt-4">
          <PageSkeleton />
        </div>
      </section>
    );
  }
  if (projectMembers.error || workspaceMembers.error) {
    return (
      <section className="mt-10" aria-labelledby="project-members-heading">
        <SectionHeading visibility={visibility} />
        <div className="mt-4">
          <QueryError
            message={
              projectMembers.error?.message ??
              workspaceMembers.error?.message ??
              'Unable to load project members.'
            }
            onRetry={() => {
              void Promise.all([
                projectMembers.refetch(),
                workspaceMembers.refetch(),
              ]);
            }}
          />
        </div>
      </section>
    );
  }

  const projectNodes = projectMembers.data?.projectMembers.nodes ?? [];
  const workspaceNodes = workspaceMembers.data?.workspaceMembers.nodes ?? [];
  const currentWorkspaceRole = workspaceNodes.find(
    (member) => member.userId === user?.id,
  )?.role;
  const currentProjectRole = projectNodes.find(
    (member) => member.userId === user?.id,
  )?.role;
  const canManage =
    currentWorkspaceRole === 'OWNER' ||
    currentWorkspaceRole === 'ADMIN' ||
    (currentWorkspaceRole === 'MEMBER' &&
      currentProjectRole === 'PROJECT_LEAD');
  const projectUserIds = new Set(projectNodes.map((member) => member.userId));
  const availableMembers = workspaceNodes.filter(
    (member) => !projectUserIds.has(member.userId),
  );
  const actionPending =
    addState.loading || updateState.loading || removeState.loading;

  return (
    <section className="mt-10" aria-labelledby="project-members-heading">
      <SectionHeading visibility={visibility} />

      {actionError ? (
        <p
          className="mt-4 rounded-xl border border-rose-900/70 bg-rose-950/30 p-3 text-sm text-rose-200"
          role="alert"
        >
          {actionError}
        </p>
      ) : null}

      {canManage ? (
        <form
          className="mt-5 grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/55 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            if (!selectedUserId) return;
            setActionError(null);
            void addProjectMember({
              variables: {
                projectId,
                role: selectedRole,
                userId: selectedUserId,
              },
            })
              .then(() => {
                setSelectedUserId('');
                setSelectedRole('MEMBER');
              })
              .catch((error: Error) => setActionError(error.message));
          }}
        >
          <label className="grid gap-1 text-xs font-semibold text-slate-400">
            Workspace member
            <select
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100"
              disabled={actionPending || availableMembers.length === 0}
              onChange={(event) => setSelectedUserId(event.target.value)}
              value={selectedUserId}
            >
              <option value="">
                {availableMembers.length
                  ? 'Choose a workspace member'
                  : 'All workspace members are assigned'}
              </option>
              {availableMembers.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.displayName} ({roleLabel(member.role)})
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-400">
            Project role
            <select
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100"
              disabled={actionPending}
              onChange={(event) =>
                setSelectedRole(event.target.value as ProjectRole)
              }
              value={selectedRole}
            >
              {editableRoles.map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
            </select>
          </label>
          <button
            className={primaryButtonClassName}
            disabled={!selectedUserId || actionPending}
            type="submit"
          >
            {addState.loading ? 'Adding…' : 'Add member'}
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          Only workspace owners, admins, and project leads can manage project
          membership.
        </p>
      )}

      {projectNodes.length ? (
        <ul className="mt-5 divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/55">
          {projectNodes.map((member) => {
            const isCurrentUser = member.userId === user?.id;
            const canEdit = canManage && !isCurrentUser;
            return (
              <li
                className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
                key={member.userId}
              >
                <div className="flex min-w-0 items-center gap-3">
                  {member.avatarUrl ? (
                    <img
                      alt=""
                      className="size-10 rounded-full object-cover"
                      src={member.avatarUrl}
                    />
                  ) : (
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-indigo-400/15 font-bold text-indigo-200">
                      {member.displayName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-100">
                      {member.displayName}{' '}
                      {isCurrentUser ? (
                        <span className="text-xs font-normal text-slate-500">
                          (you)
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Workspace {roleLabel(member.workspaceRole)} · joined{' '}
                      {formatDate(member.joinedAt)}
                    </p>
                  </div>
                </div>
                {canEdit ? (
                  <div className="flex items-center gap-2">
                    <label
                      className="sr-only"
                      htmlFor={`project-role-${member.userId}`}
                    >
                      Project role for {member.displayName}
                    </label>
                    <select
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                      disabled={actionPending}
                      id={`project-role-${member.userId}`}
                      onChange={(event) => {
                        setActionError(null);
                        void updateProjectMemberRole({
                          variables: {
                            projectId,
                            role: event.target.value,
                            userId: member.userId,
                          },
                        }).catch((error: Error) =>
                          setActionError(error.message),
                        );
                      }}
                      value={member.role}
                    >
                      {editableRoles.map((role) => (
                        <option key={role} value={role}>
                          {roleLabel(role)}
                        </option>
                      ))}
                    </select>
                    <button
                      className="rounded-lg border border-rose-900/80 px-3 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-950/40"
                      disabled={actionPending}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Remove ${member.displayName} from this project?`,
                          )
                        )
                          return;
                        setActionError(null);
                        void removeProjectMember({
                          variables: { projectId, userId: member.userId },
                        }).catch((error: Error) =>
                          setActionError(error.message),
                        );
                      }}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <span className="w-fit rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">
                    {roleLabel(member.role)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-5 rounded-xl border border-dashed border-slate-800 p-5 text-sm text-slate-500">
          No explicit project members have been added.
        </p>
      )}

      <p className="mt-4 text-xs leading-5 text-slate-500">
        Project roles cannot elevate a workspace viewer. Workspace viewers
        remain read-only even when assigned a higher project role.
      </p>
    </section>
  );
}

function SectionHeading({
  visibility,
}: {
  visibility: 'PRIVATE' | 'WORKSPACE';
}) {
  return (
    <div>
      <h2
        className="text-lg font-bold text-slate-100"
        id="project-members-heading"
      >
        Project members
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        {visibility === 'PRIVATE'
          ? 'Private project access is limited to this roster, workspace owners, and admins.'
          : 'All workspace members can discover this project; explicit roles customize project access.'}
      </p>
    </div>
  );
}

function roleLabel(role: string): string {
  return role
    .toLowerCase()
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}
