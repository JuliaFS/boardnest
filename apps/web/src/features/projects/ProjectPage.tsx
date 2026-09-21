import { useQuery } from '@apollo/client/react';
import { Link, useParams } from 'react-router';

import { PROJECT_QUERY, type ProjectData } from '../core/graphql';
import { PageHeader } from '../core/PageHeader';
import { EmptyState, PageSkeleton, QueryError } from '../core/QueryState';

export function ProjectPage() {
  const { projectId = '' } = useParams();
  const result = useQuery<ProjectData>(PROJECT_QUERY, {
    skip: !projectId,
    variables: { id: projectId },
  });

  if (result.loading) return <PageSkeleton />;
  if (result.error) return <QueryError message={result.error.message} />;
  if (!result.data?.project) {
    return (
      <EmptyState
        description="It may have been removed, or you may not have access to it."
        title="Project not found"
      />
    );
  }

  const project = result.data.project;

  return (
    <>
      <PageHeader
        actions={
          <Link
            className="rounded-lg bg-indigo-300 px-4 py-2.5 text-sm font-bold text-slate-950 no-underline hover:bg-indigo-200"
            to={`/projects/${project.id}/board`}
          >
            Open board
          </Link>
        }
        description={project.description || 'No project description yet.'}
        eyebrow="Project"
        title={project.name}
      />
      <dl className="grid gap-4 sm:grid-cols-3">
        <ProjectFact label="Status" value={project.status.replace('_', ' ')} />
        <ProjectFact label="Visibility" value={project.visibility} />
        <ProjectFact label="Due date" value={project.dueDate ?? 'Not set'} />
      </dl>
    </>
  );
}

function ProjectFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="mt-2 capitalize text-slate-100">{value.toLowerCase()}</dd>
    </div>
  );
}
