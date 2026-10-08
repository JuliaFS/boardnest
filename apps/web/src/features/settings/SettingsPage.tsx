import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  getAccountDeletionImpact,
  type AccountDeletionImpact,
} from '../auth/auth-client';
import { useAuth } from '../auth/AuthProvider';
import { PageHeader } from '../core/PageHeader';
import { PageSkeleton, QueryError } from '../core/QueryState';
import { isDeletionPlanComplete } from './account-deletion';

export function SettingsPage() {
  const { deleteAccount, user } = useAuth();
  const navigate = useNavigate();
  const [impact, setImpact] = useState<AccountDeletionImpact | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [transfers, setTransfers] = useState<Record<string, string>>({});
  const [deleteWorkspaceIds, setDeleteWorkspaceIds] = useState<Set<string>>(
    new Set(),
  );
  const [confirmation, setConfirmation] = useState('');
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function loadImpact() {
    setLoadError(null);
    void getAccountDeletionImpact()
      .then(setImpact)
      .catch((error: unknown) =>
        setLoadError(getAccountDeletionErrorMessage(error)),
      );
  }

  useEffect(loadImpact, []);

  const planComplete = useMemo(
    () =>
      impact
        ? isDeletionPlanComplete(impact, transfers, deleteWorkspaceIds)
        : false,
    [deleteWorkspaceIds, impact, transfers],
  );

  async function handleDeleteAccount() {
    if (!impact || confirmation !== 'DELETE' || !planComplete) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await deleteAccount({
        confirmation: 'DELETE',
        deleteWorkspaceIds: [...deleteWorkspaceIds],
        transfers,
      });
      void navigate('/login', { replace: true });
    } catch (error) {
      setSubmitError(getAccountDeletionErrorMessage(error));
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        description="Manage your account and decide what happens to owned workspaces before permanent deletion."
        eyebrow="Preferences"
        title="Settings"
      />

      <section className="max-w-3xl rounded-2xl border border-rose-900/70 bg-rose-950/15 p-6">
        <h2 className="text-xl font-bold text-rose-100">Delete account</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          This permanently removes{' '}
          <strong className="font-bold text-indigo-300">
            {user?.email ?? 'your account'}
          </strong>
          , memberships, assignments, reminders, and private notification data.
          Shared projects remain available to their workspace.
        </p>

        {!impact && !loadError ? <PageSkeleton /> : null}
        {loadError ? (
          <QueryError message={loadError} onRetry={loadImpact} />
        ) : null}

        {impact ? (
          <div className="mt-6 grid gap-4">
            {impact.ownedWorkspaces.length === 0 ? (
              <p className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-300">
                You do not own any workspaces. Your memberships will be removed
                automatically.
              </p>
            ) : null}

            {impact.ownedWorkspaces.map((workspace) => (
              <div
                className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"
                key={workspace.id}
              >
                <h3 className="font-semibold text-white">{workspace.name}</h3>
                <p className="mt-1 text-xs text-slate-400">
                  {workspace.memberCount} member(s) · {workspace.projectCount}{' '}
                  project(s) · {workspace.taskCount} task(s)
                </p>

                {workspace.ownershipStatus === 'transfer_required' ? (
                  <label className="mt-4 grid gap-2 text-sm text-slate-200">
                    Transfer ownership to
                    <select
                      className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                      onChange={(event) =>
                        setTransfers((current) => ({
                          ...current,
                          [workspace.id]: event.target.value,
                        }))
                      }
                      required
                      value={transfers[workspace.id] ?? ''}
                    >
                      <option value="">Choose a workspace member</option>
                      {workspace.eligibleSuccessors.map((successor) => (
                        <option key={successor.id} value={successor.id}>
                          {successor.displayName} ({successor.role})
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {workspace.ownershipStatus === 'deletion_required' ? (
                  <label className="mt-4 flex items-start gap-3 text-sm text-rose-100">
                    <input
                      checked={deleteWorkspaceIds.has(workspace.id)}
                      className="mt-1"
                      onChange={(event) => {
                        setDeleteWorkspaceIds((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(workspace.id);
                          else next.delete(workspace.id);
                          return next;
                        });
                      }}
                      type="checkbox"
                    />
                    Permanently delete this personal workspace and all of its
                    projects and tasks.
                  </label>
                ) : null}

                {workspace.ownershipStatus === 'shared_owner' ? (
                  <p className="mt-3 text-sm text-emerald-300">
                    Another owner will retain this workspace. No action is
                    required.
                  </p>
                ) : null}
              </div>
            ))}

            {!confirmationOpen ? (
              <button
                className="mt-2 rounded-lg bg-rose-700 px-4 py-3 font-bold text-white hover:bg-rose-600"
                onClick={() => setConfirmationOpen(true)}
                type="button"
              >
                Permanently delete account
              </button>
            ) : (
              <div className="mt-2 grid gap-4 rounded-xl border border-rose-900/70 bg-rose-950/30 p-4">
                <label className="grid gap-2 text-sm font-semibold text-slate-200">
                  Type DELETE to confirm
                  <input
                    autoComplete="off"
                    autoFocus
                    className="rounded-lg border border-rose-800 bg-slate-950 px-3 py-2 text-white outline-none focus:border-rose-500"
                    onChange={(event) => setConfirmation(event.target.value)}
                    value={confirmation}
                  />
                </label>

                {submitError ? (
                  <p className="text-sm text-rose-300" role="alert">
                    {submitError}
                  </p>
                ) : null}

                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    className="rounded-lg border border-slate-700 px-4 py-3 font-semibold text-slate-200 hover:bg-slate-800"
                    disabled={submitting}
                    onClick={() => {
                      setConfirmation('');
                      setSubmitError(null);
                      setConfirmationOpen(false);
                    }}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded-lg bg-rose-700 px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={
                      submitting || confirmation !== 'DELETE' || !planComplete
                    }
                    onClick={() => void handleDeleteAccount()}
                    type="button"
                  >
                    {submitting
                      ? 'Deleting account…'
                      : 'Confirm permanent deletion'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </section>
    </>
  );
}

function getAccountDeletionErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Account deletion failed. Please try again.';
}
