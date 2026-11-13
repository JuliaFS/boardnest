import { useMutation, useQuery } from '@apollo/client/react';
import { useState } from 'react';
import { Link } from 'react-router';

import { useAuth } from '../auth/AuthProvider';
import { Modal } from '../core/Modal';
import { PageHeader } from '../core/PageHeader';
import { EmptyState, PageSkeleton, QueryError } from '../core/QueryState';
import {
  REMOVE_WORKSPACE_MEMBER_MUTATION,
  REVOKE_INVITATION_MUTATION,
  UPDATE_WORKSPACE_MEMBER_ROLE_MUTATION,
  WORKSPACE_INVITATIONS_QUERY,
  WORKSPACE_MEMBERS_QUERY,
  WORKSPACES_QUERY,
  type InvitationSummary,
  type WorkspaceInvitationsData,
  type WorkspaceMembersData,
  type WorkspaceRole,
  type WorkspacesData,
} from '../core/graphql';
import { primaryButtonClassName } from '../core/form-styles';
import { InviteMemberForm } from './InviteMemberForm';

type InvitationResult = {
  emailChanged?: boolean;
  emailSent: boolean;
  invitation: InvitationSummary;
  token: string | null;
};

const editableRoles: Exclude<WorkspaceRole, 'OWNER'>[] = [
  'ADMIN',
  'MEMBER',
  'VIEWER',
];

export function MembersPage() {
  const { user } = useAuth();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingInvitation, setEditingInvitation] =
    useState<InvitationSummary | null>(null);
  const [invitationResult, setInvitationResult] =
    useState<InvitationResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const workspaces = useQuery<WorkspacesData>(WORKSPACES_QUERY);
  const workspaceNodes = workspaces.data?.workspaces.nodes ?? [];
  const activeWorkspaceId =
    workspaceNodes.find(({ id }) => id === selectedWorkspaceId)?.id ??
    workspaceNodes[0]?.id ??
    '';
  const members = useQuery<WorkspaceMembersData>(WORKSPACE_MEMBERS_QUERY, {
    skip: !activeWorkspaceId,
    variables: { workspaceId: activeWorkspaceId },
  });
  const currentMembership = members.data?.workspaceMembers.nodes.find(
    ({ userId }) => userId === user?.id,
  );
  const canManage =
    currentMembership?.role === 'OWNER' || currentMembership?.role === 'ADMIN';
  const invitations = useQuery<WorkspaceInvitationsData>(
    WORKSPACE_INVITATIONS_QUERY,
    {
      skip: !activeWorkspaceId || !canManage,
      variables: { workspaceId: activeWorkspaceId },
    },
  );
  const [updateRole, updateRoleState] = useMutation(
    UPDATE_WORKSPACE_MEMBER_ROLE_MUTATION,
    { refetchQueries: [WORKSPACE_MEMBERS_QUERY] },
  );
  const [removeMember, removeMemberState] = useMutation(
    REMOVE_WORKSPACE_MEMBER_MUTATION,
    { refetchQueries: [WORKSPACE_MEMBERS_QUERY] },
  );
  const [revokeInvitation, revokeState] = useMutation(
    REVOKE_INVITATION_MUTATION,
    { refetchQueries: [WORKSPACE_INVITATIONS_QUERY] },
  );
  const actionPending =
    updateRoleState.loading || removeMemberState.loading || revokeState.loading;
  const invitationLink = invitationResult?.token
    ? `${window.location.origin}/invite/${invitationResult.token}`
    : null;

  if (workspaces.loading) return <PageSkeleton />;
  if (workspaces.error) {
    return (
      <QueryError
        message={workspaces.error.message}
        onRetry={() => void workspaces.refetch()}
      />
    );
  }

  return (
    <>
      <PageHeader
        actions={
          <div className="flex flex-wrap items-end gap-3">
            {workspaceNodes.length > 0 ? (
              <label className="grid gap-1 text-xs font-semibold text-slate-400">
                Workspace
                <select
                  className="min-w-56 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  onChange={(event) => {
                    setSelectedWorkspaceId(event.target.value);
                    setActionError(null);
                  }}
                  value={activeWorkspaceId}
                >
                  {workspaceNodes.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {canManage ? (
              <button
                className={primaryButtonClassName}
                onClick={() => setInviteOpen(true)}
                type="button"
              >
                Invite member
              </button>
            ) : null}
          </div>
        }
        description="See who belongs to a workspace and manage access from one place."
        eyebrow="Collaboration"
        title="Members"
      />

      {!activeWorkspaceId ? (
        <EmptyState
          description="Create a workspace before inviting people to collaborate."
          title="No workspaces available"
        />
      ) : members.loading ? (
        <PageSkeleton />
      ) : members.error ? (
        <QueryError
          message={members.error.message}
          onRetry={() => void members.refetch()}
        />
      ) : (
        <div className="grid gap-8">
          {actionError ? (
            <p
              className="rounded-xl border border-rose-900/70 bg-rose-950/30 p-3 text-sm text-rose-200"
              role="alert"
            >
              {actionError}
            </p>
          ) : null}

          <section aria-labelledby="workspace-members-heading">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <h2
                  className="text-lg font-bold text-slate-100"
                  id="workspace-members-heading"
                >
                  Workspace members
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Workspace roles are the upper limit for project permissions.
                </p>
              </div>
              <span className="text-sm text-slate-500">
                {members.data?.workspaceMembers.nodes.length ?? 0} total
              </span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/55">
              <ul className="divide-y divide-slate-800">
                {members.data?.workspaceMembers.nodes.map((member) => {
                  const isCurrentUser = member.userId === user?.id;
                  const canEditMember =
                    canManage && !isCurrentUser && member.role !== 'OWNER';
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
                            Joined {formatDate(member.joinedAt)}
                          </p>
                        </div>
                      </div>
                      {canEditMember ? (
                        <div className="flex items-center gap-2">
                          <label
                            className="sr-only"
                            htmlFor={`role-${member.userId}`}
                          >
                            Role for {member.displayName}
                          </label>
                          <select
                            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                            disabled={actionPending}
                            id={`role-${member.userId}`}
                            onChange={(event) => {
                              setActionError(null);
                              void updateRole({
                                variables: {
                                  role: event.target.value,
                                  userId: member.userId,
                                  workspaceId: activeWorkspaceId,
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
                                  `Remove ${member.displayName} from this workspace?`,
                                )
                              )
                                return;
                              setActionError(null);
                              void removeMember({
                                variables: {
                                  userId: member.userId,
                                  workspaceId: activeWorkspaceId,
                                },
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
            </div>
          </section>

          {canManage ? (
            <section aria-labelledby="pending-invitations-heading">
              <h2
                className="text-lg font-bold text-slate-100"
                id="pending-invitations-heading"
              >
                Pending invitations
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Invitations expire after seven days and can be revoked before
                they are accepted.
              </p>
              {invitations.loading ? (
                <div className="mt-4">
                  <PageSkeleton />
                </div>
              ) : invitations.error ? (
                <div className="mt-4">
                  <QueryError
                    message={invitations.error.message}
                    onRetry={() => void invitations.refetch()}
                  />
                </div>
              ) : invitations.data?.workspaceInvitations.nodes.length ? (
                <ul className="mt-4 grid gap-3">
                  {invitations.data.workspaceInvitations.nodes.map(
                    (invitation) => (
                      <li
                        className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/55 p-4 sm:flex-row sm:items-center sm:justify-between"
                        key={invitation.id}
                      >
                        <div>
                          <p className="font-semibold text-slate-100">
                            {invitation.email}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {roleLabel(invitation.role)} · expires{' '}
                            {formatDate(invitation.expiresAt)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {!user?.isAnonymous ? (
                            <button
                              className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
                              disabled={actionPending}
                              onClick={() => {
                                setEditingInvitation(invitation);
                                setInviteOpen(true);
                              }}
                              type="button"
                            >
                              Change email
                            </button>
                          ) : null}
                          <button
                            className="w-fit rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
                            disabled={actionPending}
                            onClick={() => {
                              setActionError(null);
                              void revokeInvitation({
                                variables: { id: invitation.id },
                              }).catch((error: Error) =>
                                setActionError(error.message),
                              );
                            }}
                            type="button"
                          >
                            Revoke
                          </button>
                        </div>
                      </li>
                    ),
                  )}
                </ul>
              ) : (
                <p className="mt-4 rounded-xl border border-dashed border-slate-800 p-5 text-sm text-slate-500">
                  There are no pending invitations.
                </p>
              )}
            </section>
          ) : (
            <p className="text-sm text-slate-500">
              Only workspace owners and admins can manage members and
              invitations.
            </p>
          )}

          <p className="text-sm leading-6 text-slate-500">
            Workspace projects are visible to all workspace members. Private
            projects require an additional project membership, which will be
            managed from the project page in the project-members stage.{' '}
            <Link to="/projects">View projects</Link>
          </p>
        </div>
      )}

      {inviteOpen && activeWorkspaceId ? (
        <Modal
          description={
            editingInvitation
              ? 'An invitation will be sent to the updated email address. The previous link will no longer work.'
              : 'Invite someone to the workspace and choose their maximum access level.'
          }
          onClose={() => {
            setInviteOpen(false);
            setEditingInvitation(null);
          }}
          title={
            editingInvitation
              ? 'Change invitation email'
              : 'Invite workspace member'
          }
        >
          <InviteMemberForm
            key={editingInvitation?.id ?? 'new'}
            {...(editingInvitation ? { invitation: editingInvitation } : {})}
            onCancel={() => {
              setInviteOpen(false);
              setEditingInvitation(null);
            }}
            onCompleted={(result) => {
              setInviteOpen(false);
              setInvitationResult({
                ...result,
                emailChanged: Boolean(editingInvitation),
              });
              setEditingInvitation(null);
              setCopied(false);
            }}
            workspaceId={activeWorkspaceId}
          />
        </Modal>
      ) : null}

      {invitationResult ? (
        <Modal
          description={
            invitationResult.emailSent
              ? 'The invitation was stored securely and delivered by email.'
              : 'The invitation was stored securely and its one-time link is shown only now.'
          }
          onClose={() => setInvitationResult(null)}
          title={
            invitationResult.emailChanged
              ? 'Invitation email changed'
              : 'Invitation created'
          }
        >
          <div className="grid gap-4">
            <p className="text-sm leading-6 text-slate-300">
              {invitationResult.emailSent ? (
                <>
                  The invitation email was sent to{' '}
                  <strong>{invitationResult.invitation.email}</strong>.
                </>
              ) : (
                <>
                  Email delivery is not configured or failed. Share the link
                  below securely with{' '}
                  <strong>{invitationResult.invitation.email}</strong>.
                </>
              )}
            </p>
            {invitationLink ? (
              <code className="break-all rounded-xl border border-slate-700 bg-slate-950 p-4 text-xs text-indigo-200">
                {invitationLink}
              </code>
            ) : null}
            <div className="flex justify-end gap-3">
              {invitationLink ? (
                <button
                  className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(invitationLink)
                      .then(() => setCopied(true));
                  }}
                  type="button"
                >
                  {copied ? 'Copied' : 'Copy invitation link'}
                </button>
              ) : null}
              <button
                className={primaryButtonClassName}
                onClick={() => setInvitationResult(null)}
                type="button"
              >
                Done
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function roleLabel(role: WorkspaceRole): string {
  return role.slice(0, 1) + role.slice(1).toLowerCase();
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}
