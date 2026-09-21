import { useMutation, useQuery } from '@apollo/client/react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import {
  BOARD_QUERY,
  DELETE_TASK_MUTATION,
  TASK_QUERY,
  type TaskData,
} from '../core/graphql';
import { secondaryButtonClassName } from '../core/form-styles';
import { Modal } from '../core/Modal';
import { PageHeader } from '../core/PageHeader';
import { EmptyState, PageSkeleton, QueryError } from '../core/QueryState';
import { TaskForm } from './TaskForm';

export function TaskPage() {
  const { projectId = '', taskId = '' } = useParams();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const result = useQuery<TaskData>(TASK_QUERY, {
    skip: !taskId,
    variables: { id: taskId },
  });
  const [deleteTask, deletion] = useMutation(DELETE_TASK_MUTATION);

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
        actions={
          <div className="flex flex-wrap gap-3">
            <Link
              className={secondaryButtonClassName}
              to={`/projects/${projectId}/board`}
            >
              Back to board
            </Link>
            <button
              className="rounded-lg bg-indigo-300 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-indigo-200"
              onClick={() => setEditing(true)}
              type="button"
            >
              Edit task
            </button>
          </div>
        }
        description={task.description || 'No task description yet.'}
        eyebrow={`Priority: ${task.priority.toLowerCase()}`}
        title={task.title}
      />

      <dl className="grid gap-4 sm:grid-cols-2">
        <TaskFact label="Priority" value={task.priority.toLowerCase()} />
        <TaskFact
          label="Due date"
          value={
            task.dueAt
              ? new Intl.DateTimeFormat(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(task.dueAt))
              : 'Not set'
          }
        />
      </dl>

      <section className="mt-10 rounded-2xl border border-rose-950 bg-rose-950/10 p-5">
        <h2 className="font-semibold text-rose-200">Danger zone</h2>
        <p className="mt-1 text-sm text-slate-400">
          Deleting a task also removes its comments, labels, and assignments.
        </p>
        <button
          className="mt-4 rounded-lg border border-rose-800 px-3 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-950/50"
          onClick={() => setConfirmingDelete(true)}
          type="button"
        >
          Delete task
        </button>
      </section>

      {editing ? (
        <Modal onClose={() => setEditing(false)} title="Edit task">
          <TaskForm
            onCancel={() => setEditing(false)}
            onCompleted={() => setEditing(false)}
            projectId={projectId}
            task={task}
          />
        </Modal>
      ) : null}
      {confirmingDelete ? (
        <Modal
          description={`This will permanently delete “${task.title}”.`}
          onClose={() => setConfirmingDelete(false)}
          title="Delete task?"
        >
          {deletion.error ? (
            <p className="mb-4 text-sm text-rose-300" role="alert">
              {deletion.error.message}
            </p>
          ) : null}
          <div className="flex justify-end gap-3">
            <button
              className={secondaryButtonClassName}
              onClick={() => setConfirmingDelete(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-lg bg-rose-400 px-4 py-2.5 text-sm font-bold text-rose-950 disabled:opacity-60"
              disabled={deletion.loading}
              onClick={() => {
                void deleteTask({
                  refetchQueries: [
                    { query: BOARD_QUERY, variables: { projectId } },
                  ],
                  variables: { id: task.id },
                })
                  .then(() =>
                    navigate(`/projects/${projectId}/board`, { replace: true }),
                  )
                  .catch(() => undefined);
              }}
              type="button"
            >
              {deletion.loading ? 'Deleting…' : 'Delete permanently'}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function TaskFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="mt-2 capitalize text-slate-100">{value}</dd>
    </div>
  );
}
