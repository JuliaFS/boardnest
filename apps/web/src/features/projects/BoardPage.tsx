import { useQuery } from '@apollo/client/react';
import { useParams } from 'react-router';

import { PROJECT_QUERY, type ProjectData } from '../core/graphql';
import { PageHeader } from '../core/PageHeader';
import { EmptyState, PageSkeleton, QueryError } from '../core/QueryState';

export function BoardPage() {
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

  return (
    <>
      <PageHeader
        description="The Kanban board, task filters and drag-and-drop workflow will be implemented in Phase 6."
        eyebrow="Board"
        title={result.data.project.name}
      />
      <div className="grid gap-4 overflow-hidden md:grid-cols-2 xl:grid-cols-4">
        {['To do', 'In progress', 'In review', 'Done'].map((status) => (
          <section
            className="min-h-56 rounded-2xl border border-slate-800 bg-slate-900/50 p-4"
            key={status}
          >
            <h2 className="text-sm font-semibold text-slate-200">{status}</h2>
            <p className="mt-8 text-center text-xs text-slate-600">Phase 6</p>
          </section>
        ))}
      </div>
    </>
  );
}
