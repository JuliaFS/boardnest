import { useQuery } from '@apollo/client/react';
import { useParams } from 'react-router';

import {
  PROJECTS_QUERY,
  WORKSPACE_QUERY,
  type ProjectsData,
  type WorkspaceData,
} from '../core/graphql';
import { PageHeader } from '../core/PageHeader';
import { EmptyState, PageSkeleton, QueryError } from '../core/QueryState';
import { ProjectCard } from '../projects/ProjectCard';

export function WorkspacePage() {
  const { workspaceId = '' } = useParams();
  const workspace = useQuery<WorkspaceData>(WORKSPACE_QUERY, {
    skip: !workspaceId,
    variables: { id: workspaceId },
  });
  const projects = useQuery<ProjectsData>(PROJECTS_QUERY, {
    skip: !workspaceId,
    variables: { workspaceId },
  });

  if (workspace.loading) return <PageSkeleton />;
  if (workspace.error) return <QueryError message={workspace.error.message} />;
  if (!workspace.data?.workspace) {
    return (
      <EmptyState
        description="It may have been removed, or you may not have access to it."
        title="Workspace not found"
      />
    );
  }

  return (
    <>
      <PageHeader
        description={`Workspace slug: ${workspace.data.workspace.slug}`}
        eyebrow="Workspace"
        title={workspace.data.workspace.name}
      />
      {projects.loading ? (
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
          description="Projects created in this workspace will appear here."
          title="No projects yet"
        />
      )}
    </>
  );
}
