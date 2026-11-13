import { useMutation } from '@apollo/client/react';
import { Link, useParams } from 'react-router';
import { z } from 'zod';

import { useAuth } from '../auth/AuthProvider';
import {
  ACCEPT_INVITATION_MUTATION,
  ACCEPT_INVITATION_BY_ID_MUTATION,
  WORKSPACES_QUERY,
  type InvitationAcceptanceSummary,
} from '../core/graphql';

interface AcceptInvitationResult {
  acceptInvitation?: InvitationAcceptanceSummary;
  acceptInvitationById?: InvitationAcceptanceSummary;
}

export function InvitationAcceptancePage() {
  const { user } = useAuth();
  const { token = '' } = useParams();
  const byId = z.uuid().safeParse(token).success;
  const validInvitation = byId || /^[A-Za-z0-9_-]{43}$/.test(token);
  const [acceptInvitation, mutation] = useMutation<
    AcceptInvitationResult,
    { token?: string; id?: string }
  >(byId ? ACCEPT_INVITATION_BY_ID_MUTATION : ACCEPT_INVITATION_MUTATION, {
    refetchQueries: [WORKSPACES_QUERY],
  });
  const accepted =
    mutation.data?.acceptInvitation ?? mutation.data?.acceptInvitationById;

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="invitation-title">
        <Link className="brand" to="/dashboard">
          Boardnest
        </Link>
        <h1 id="invitation-title">
          {accepted ? 'Invitation accepted' : 'Workspace invitation'}
        </h1>
        {accepted ? (
          <>
            <p className="auth-description">
              You joined the workspace as {roleLabel(accepted.role)}.
            </p>
            <Link
              className="primary-button button-link"
              to={`/workspaces/${accepted.workspaceId}`}
            >
              Open workspace
            </Link>
          </>
        ) : user?.isAnonymous ? (
          <>
            <p className="auth-description error-message" role="alert">
              Guest accounts cannot accept email invitations. Sign out and use
              the invited registered account.
            </p>
            <Link className="secondary-button button-link" to="/dashboard">
              Return to dashboard
            </Link>
          </>
        ) : (
          <>
            <p className="auth-description">
              This invitation must match the email of your signed-in account
              {user?.email ? ` (${user.email})` : ''}.
            </p>
            {mutation.error ? (
              <p className="form-message error-message" role="alert">
                {mutation.error.message}
              </p>
            ) : null}
            <button
              className="primary-button"
              disabled={mutation.loading || !validInvitation}
              onClick={() =>
                void acceptInvitation({
                  variables: byId ? { id: token } : { token },
                }).catch(() => undefined)
              }
              type="button"
            >
              {mutation.loading ? 'Accepting…' : 'Accept invitation'}
            </button>
            {!validInvitation ? (
              <p className="form-message error-message" role="alert">
                This invitation link is invalid.
              </p>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}

function roleLabel(role: string): string {
  return role.slice(0, 1) + role.slice(1).toLowerCase();
}
