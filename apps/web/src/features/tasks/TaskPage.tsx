import { useQuery } from '@apollo/client/react';
import { useParams } from 'react-router';

import { TASK_QUERY, type TaskData } from '../core/graphql';
import { PageHeader } from '../core/PageHeader';
import { EmptyState, PageSkeleton, QueryError } from '../core/QueryState';

export function TaskPage() {
  const { taskId = '' } = useParams();
  const result = useQuery<TaskData>(TASK_QUERY, {
    skip: !taskId,
    variables: { id: taskId },
  });

  if (result.loading) return <PageSkeleton />;
  if (result.error) return <QueryError message={result.error.message} />;
  if (!result.data?.task) {
    return (
      <EmptyState
        description="It may have been removed, or you may not have access to it."
        title="Task not found"
      />
    );
  }

  const task = result.data.task;

  return (
    <>
      <PageHeader
        description={task.description || 'No task description yet.'}
        eyebrow={`Priority: ${task.priority.toLowerCase()}`}
        title={task.title}
      />
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Task editing, assignees, labels and comments will be connected in Phase
        6.
      </div>
    </>
  );
}
