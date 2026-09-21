import { useState } from 'react';

import { getAuthErrorMessage } from './auth-errors';
import { useAuth } from './AuthProvider';

export function DashboardPage() {
  const { signOut, user } = useAuth();
  const [signOutError, setSignOutError] = useState<string | null>(null);

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
        <h1 id="dashboard-title">Welcome, {user?.displayName ?? 'there'}</h1>
        <p className="dashboard-copy">
          Your Supabase session is active. Workspaces and projects will appear
          here in the next application phases.
        </p>
        <div className="verification verification-success">
          API session verified for {user?.email ?? user?.id}. Tokens are stored
          only in HttpOnly cookies.
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
