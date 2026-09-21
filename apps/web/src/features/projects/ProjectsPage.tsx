import { useQuery } from '@apollo/client/react';
import { useState } from 'react';

import {
  PROJECTS_QUERY,
  WORKSPACES_QUERY,
  type ProjectsData,
  type WorkspacesData,
} from '../core/graphql';
import { PageHeader } from '../core/PageHeader';
import { EmptyState, PageSkeleton, QueryError } from '../core/QueryState';
import { ProjectCard } from './ProjectCard';

export function ProjectsPage() {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const workspaces = useQuery<WorkspacesData>(WORKSPACES_QUERY);
  const workspaceNodes = workspaces.data?.workspaces.nodes ?? [];
  const activeWorkspaceId =
    workspaceNodes.find(({ id }) => id === selectedWorkspaceId)?.id ??
    workspaceNodes[0]?.id ??
    '';
  const projects = useQuery<ProjectsData>(PROJECTS_QUERY, {
    skip: !activeWorkspaceId,
    variables: { workspaceId: activeWorkspaceId },
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

  return (
    <>
      <PageHeader
        actions={
          workspaceNodes.length > 0 ? (
            <label className="grid gap-1 text-xs font-semibold text-slate-400">
              Workspace
              <select
                className="min-w-56 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                onChange={(event) => setSelectedWorkspaceId(event.target.value)}
                value={activeWorkspaceId}
              >
                {workspaceNodes.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null
        }
        description="Browse the projects that are visible to you in each workspace."
        eyebrow="Portfolio"
        title="Projects"
      />

      {!activeWorkspaceId ? (
        <EmptyState
          description="Create a workspace first to start organizing projects."
          title="No workspaces available"
        />
      ) : projects.loading ? (
        <PageSkeleton />
      ) : projects.error ? (
        <QueryError
          message={projects.error.message}
          onRetry={() => void projects.refetch()}
        />
      ) : projects.data?.projects.nodes.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {projects.data.projects.nodes.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <EmptyState
          description="Project creation and management will be connected in Phase 6."
          title="No projects here yet"
        />
      )}
    </>
  );
}
