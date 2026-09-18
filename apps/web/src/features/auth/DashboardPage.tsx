import { useEffect, useState } from 'react';

import { verifyBackendSession, type BackendUser } from './backend-session';
import { getAuthErrorMessage } from './auth-errors';
import { useAuth } from './AuthProvider';

type VerificationState =
  | { status: 'loading' }
  | { status: 'success'; user: BackendUser }
  | { message: string; status: 'error' };

export function DashboardPage() {
  const { session, signOut } = useAuth();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [verification, setVerification] = useState<VerificationState>({
    status: 'loading',
  });

  useEffect(() => {
    if (!session) return;

    const controller = new AbortController();

    void verifyBackendSession(session.access_token, controller.signal)
      .then((user) => setVerification({ status: 'success', user }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError')
          return;
        setVerification({
          message:
            error instanceof Error ? error.message : 'Verification failed.',
          status: 'error',
        });
      });

    return () => controller.abort();
  }, [session]);

  const displayName =
    typeof session?.user.user_metadata.display_name === 'string'
      ? session.user.user_metadata.display_name
      : 'there';

  async function handleSignOut() {
    setSignOutError(null);
    try {
      await signOut();
    } catch (error) {
      setSignOutError(getAuthErrorMessage(error));
    }
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <a className="brand" href="/dashboard">
          Boardnest
        </a>
        <button
          className="secondary-button"
          onClick={() => void handleSignOut()}
          type="button"
        >
          Sign out
        </button>
      </header>
      <section className="dashboard-card" aria-labelledby="dashboard-title">
        <p className="eyebrow">Phase 3</p>
        <h1 id="dashboard-title">Welcome, {displayName}</h1>
        <p className="dashboard-copy">
          Your Supabase session is active. Workspaces and projects will appear
          here in the next application phases.
        </p>
        <div className={`verification verification-${verification.status}`}>
          {verification.status === 'loading'
            ? 'Verifying the access token with the Boardnest API…'
            : null}
          {verification.status === 'success'
            ? `API session verified for ${verification.user.email ?? verification.user.id}.`
            : null}
          {verification.status === 'error' ? verification.message : null}
        </div>
        {signOutError ? (
          <p className="form-message error-message" role="alert">
            {signOutError}
          </p>
        ) : null}
      </section>
    </main>
  );
}
