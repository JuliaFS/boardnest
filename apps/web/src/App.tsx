import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';

import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { ProtectedRoute, PublicOnlyRoute } from './features/auth/route-guards';
import { AppLayout } from './features/core/AppLayout';

const DashboardPage = lazy(() =>
  import('./features/auth/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
);
const WorkspacePage = lazy(() =>
  import('./features/workspaces/WorkspacePage').then((module) => ({
    default: module.WorkspacePage,
  })),
);
const ProjectsPage = lazy(() =>
  import('./features/projects/ProjectsPage').then((module) => ({
    default: module.ProjectsPage,
  })),
);
const ProjectPage = lazy(() =>
  import('./features/projects/ProjectPage').then((module) => ({
    default: module.ProjectPage,
  })),
);
const BoardPage = lazy(() =>
  import('./features/projects/BoardPage').then((module) => ({
    default: module.BoardPage,
  })),
);
const TaskPage = lazy(() =>
  import('./features/tasks/TaskPage').then((module) => ({
    default: module.TaskPage,
  })),
);
const NotificationsPage = lazy(() =>
  import('./features/notifications/NotificationsPage').then((module) => ({
    default: module.NotificationsPage,
  })),
);
const MembersPage = lazy(() =>
  import('./features/members/MembersPage').then((module) => ({
    default: module.MembersPage,
  })),
);
const InvitationAcceptancePage = lazy(() =>
  import('./features/members/InvitationAcceptancePage').then((module) => ({
    default: module.InvitationAcceptancePage,
  })),
);
const SettingsPage = lazy(() =>
  import('./features/settings/SettingsPage').then((module) => ({
    default: module.SettingsPage,
  })),
);

export function App() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route path="/invite/:token" element={<InvitationAcceptancePage />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route
              path="/workspaces/:workspaceId"
              element={<WorkspacePage />}
            />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:projectId" element={<ProjectPage />} />
            <Route path="/projects/:projectId/board" element={<BoardPage />} />
            <Route
              path="/projects/:projectId/tasks/:taskId"
              element={<TaskPage />}
            />
            <Route path="/members" element={<MembersPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route path="/" element={<Navigate replace to="/dashboard" />} />
        <Route path="*" element={<Navigate replace to="/dashboard" />} />
      </Routes>
    </Suspense>
  );
}

function RouteLoader() {
  return (
    <main className="page-loader" role="status">
      <span className="spinner" aria-hidden="true" />
      Loading page…
    </main>
  );
}
