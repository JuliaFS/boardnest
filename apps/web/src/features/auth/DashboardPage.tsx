import { useQuery } from '@apollo/client/react';
import { Link } from 'react-router';

import {
  PROJECTS_QUERY,
  WORKSPACES_QUERY,
  type ProjectsData,
  type WorkspacesData,
} from '../core/graphql';
import { EmptyState, PageSkeleton, QueryError } from '../core/QueryState';
import { PageHeader } from '../core/PageHeader';
import { ProjectCard } from '../projects/ProjectCard';
import { useAuth } from './AuthProvider';

export function DashboardPage() {
  const { user } = useAuth();
  const workspaces = useQuery<WorkspacesData>(WORKSPACES_QUERY);
  const selectedWorkspace = workspaces.data?.workspaces.nodes[0];
  const projects = useQuery<ProjectsData>(PROJECTS_QUERY, {
    skip: !selectedWorkspace,
    variables: { workspaceId: selectedWorkspace?.id ?? '' },
  });

  if (workspaces.loading) return <PageSkeleton />;

  if (workspaces.error) {
    return (
      <QueryError
        message={workspaces.error.message}
        onRetry={() => void workspaces.refetch()}
      />
    );
  }

  const workspaceNodes = workspaces.data?.workspaces.nodes ?? [];
  const projectNodes = projects.data?.projects.nodes ?? [];

  return (
    <>
      <PageHeader
        description="A focused view of your workspaces and recently updated projects."
        eyebrow="Overview"
        title={`Welcome back, ${user?.displayName?.split(' ')[0] ?? 'there'}`}
      />

      <section
        aria-label="Workspace summary"
        className="grid gap-4 sm:grid-cols-2"
      >
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <p className="text-sm text-slate-400">Workspaces</p>
          <p className="mt-2 text-3xl font-bold text-white">
            {workspaceNodes.length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <p className="text-sm text-slate-400">
            Projects in current workspace
          </p>
          <p className="mt-2 text-3xl font-bold text-white">
            {projects.loading ? '—' : projectNodes.length}
          </p>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Recent projects</h2>
            {selectedWorkspace ? (
              <Link
                className="mt-1 inline-block text-sm text-indigo-300 no-underline hover:text-indigo-200"
                to={`/workspaces/${selectedWorkspace.id}`}
              >
                {selectedWorkspace.name}
              </Link>
            ) : null}
          </div>
          <Link
            className="text-sm font-semibold text-indigo-300 no-underline"
            to="/projects"
          >
            View all
          </Link>
        </div>
        {!selectedWorkspace ? (
          <EmptyState
            description="Workspace creation will be available from the interface in Phase 6."
            title="No workspaces yet"
          />
        ) : projects.loading ? (
          <PageSkeleton />
        ) : projects.error ? (
          <QueryError
            message={projects.error.message}
            onRetry={() => void projects.refetch()}
          />
        ) : projectNodes.length === 0 ? (
          <EmptyState
            description="This workspace is ready for its first project. Project creation arrives in Phase 6."
            title="No projects in this workspace"
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {projectNodes.slice(0, 4).map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
