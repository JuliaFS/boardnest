import { Navigate, Outlet, useLocation } from 'react-router';

import { useAuth } from './AuthProvider';

export function ProtectedRoute() {
  const { isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageLoader />;

  if (!user) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { isLoading, user } = useAuth();

  if (isLoading) return <FullPageLoader />;
  if (user) return <Navigate replace to="/dashboard" />;

  return <Outlet />;
}

function FullPageLoader() {
  return (
    <main className="page-loader" role="status">
      <span className="spinner" aria-hidden="true" />
      Loading your session…
    </main>
  );
}
