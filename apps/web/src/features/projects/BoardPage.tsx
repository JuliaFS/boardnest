import { move } from '@dnd-kit/helpers';
import { DragDropProvider } from '@dnd-kit/react';
import { useMutation, useQuery } from '@apollo/client/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';

import {
  BOARD_QUERY,
  MOVE_TASK_MUTATION,
  PROJECT_QUERY,
  type BoardData,
  type ProjectData,
  type TaskStatusSummary,
  type TaskSummary,
} from '../core/graphql';
import { fieldClassName, primaryButtonClassName } from '../core/form-styles';
import { Modal } from '../core/Modal';
import { PageHeader } from '../core/PageHeader';
import { EmptyState, PageSkeleton, QueryError } from '../core/QueryState';
import { KanbanColumn } from '../tasks/KanbanColumn';
import { TaskForm } from '../tasks/TaskForm';
import { positionAt } from '../tasks/task-order';

type TaskGroups = Record<string, TaskSummary[]>;

export function BoardPage() {
  const { projectId = '' } = useParams();
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState<TaskSummary['priority'] | 'ALL'>(
    'ALL',
  );
  const [creatingInStatus, setCreatingInStatus] = useState<string | null>(null);
  const [groups, setGroups] = useState<TaskGroups>({});
  const groupsRef = useRef<TaskGroups>({});
  const beforeDragRef = useRef<TaskGroups>({});
  const [dragError, setDragError] = useState<string | null>(null);
  const project = useQuery<ProjectData>(PROJECT_QUERY, {
    skip: !projectId,
    variables: { id: projectId },
  });
  const board = useQuery<BoardData>(BOARD_QUERY, {
    skip: !projectId,
    variables: { projectId },
  });
  const [moveTask] = useMutation(MOVE_TASK_MUTATION);

  useEffect(() => {
    if (!board.data) return;
    const nextGroups = groupTasks(
      board.data.taskStatuses,
      board.data.tasks.nodes,
    );
    groupsRef.current = nextGroups;
    setGroups(nextGroups);
  }, [board.data]);

  const filtersActive = search.trim().length > 0 || priority !== 'ALL';
  const visibleGroups = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return Object.fromEntries(
      Object.entries(groups).map(([statusId, tasks]) => [
        statusId,
        tasks.filter(
          (task) =>
            (priority === 'ALL' || task.priority === priority) &&
            (!query ||
              task.title.toLocaleLowerCase().includes(query) ||
              task.description?.toLocaleLowerCase().includes(query)),
        ),
      ]),
    );
  }, [groups, priority, search]);

  if (project.loading || board.loading) return <PageSkeleton />;
  if (project.error) return <QueryError message={project.error.message} />;
  if (board.error) {
    return (
      <QueryError
        message={board.error.message}
        onRetry={() => void board.refetch()}
      />
    );
  }
  if (!project.data?.project) {
    return (
      <EmptyState
        description="It may have been removed, or you may not have access to it."
        title="Project not found"
      />
    );
  }

  const statuses = board.data?.taskStatuses ?? [];
  const selectedStatus = statuses.find(({ id }) => id === creatingInStatus);
  const selectedTasks = selectedStatus ? (groups[selectedStatus.id] ?? []) : [];
  const nextPosition = (selectedTasks.at(-1)?.position ?? 0) + 1000;

  return (
    <>
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 no-underline hover:bg-slate-800"
              to={`/projects/${projectId}`}
            >
              Project details
            </Link>
            {statuses[0] ? (
              <button
                className={primaryButtonClassName}
                onClick={() => setCreatingInStatus(statuses[0]?.id ?? null)}
                type="button"
              >
                New task
              </button>
            ) : null}
          </div>
        }
        description="Drag tasks between columns or use the keyboard to reorganize the workflow."
        eyebrow="Board"
        title={project.data.project.name}
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search tasks</span>
          <input
            className={fieldClassName}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search task title or description…"
            type="search"
            value={search}
          />
        </label>
        <label>
          <span className="sr-only">Filter by priority</span>
          <select
            className={fieldClassName}
            onChange={(event) =>
              setPriority(event.target.value as TaskSummary['priority'] | 'ALL')
            }
            value={priority}
          >
            <option value="ALL">All priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
            <option value="NONE">No priority</option>
          </select>
        </label>
      </div>
      {filtersActive ? (
        <p className="mb-4 text-xs text-slate-500">
          Reordering is paused while filters are active. Clear the filters to
          move tasks.
        </p>
      ) : null}
      {dragError ? (
        <p
          className="mb-4 rounded-xl border border-rose-900/70 bg-rose-950/30 p-3 text-sm text-rose-300"
          role="alert"
        >
          {dragError}
        </p>
      ) : null}

      {statuses.length === 0 ? (
        <EmptyState
          description="This project has no task statuses. Check that its default statuses were created."
          title="Board columns are missing"
        />
      ) : (
        <DragDropProvider
          onDragEnd={(event) => {
            if (event.canceled) {
              groupsRef.current = beforeDragRef.current;
              setGroups(beforeDragRef.current);
              return;
            }

            const taskId = String(event.operation.source?.id ?? '');
            const destination = findTask(groupsRef.current, taskId);
            if (!destination) return;
            const position = positionAt(destination.tasks, destination.index);
            setDragError(null);
            void moveTask({
              awaitRefetchQueries: true,
              refetchQueries: [
                { query: BOARD_QUERY, variables: { projectId } },
              ],
              variables: {
                id: taskId,
                input: { position, statusId: destination.statusId },
              },
            }).catch((error: unknown) => {
              groupsRef.current = beforeDragRef.current;
              setGroups(beforeDragRef.current);
              setDragError(
                error instanceof Error
                  ? error.message
                  : 'The task could not be moved.',
              );
            });
          }}
          onDragOver={(event) => {
            setGroups((current) => {
              const next = move(current, event);
              groupsRef.current = next;
              return next;
            });
          }}
          onDragStart={() => {
            beforeDragRef.current = cloneGroups(groupsRef.current);
          }}
        >
          <div className="flex gap-4 overflow-x-auto pb-5">
            {statuses.map((status) => (
              <KanbanColumn
                disabled={filtersActive}
                key={status.id}
                onCreateTask={setCreatingInStatus}
                status={status}
                tasks={visibleGroups[status.id] ?? []}
              />
            ))}
          </div>
        </DragDropProvider>
      )}

      {board.data?.tasks.pageInfo.hasNextPage ? (
        <p className="mt-3 text-xs text-amber-300">
          This board is showing the first 100 tasks. Pagination will be expanded
          in a later iteration.
        </p>
      ) : null}

      {selectedStatus ? (
        <Modal
          description={`The task will be added to “${selectedStatus.name}”.`}
          onClose={() => setCreatingInStatus(null)}
          title="Create task"
        >
          <TaskForm
            initialPosition={nextPosition}
            onCancel={() => setCreatingInStatus(null)}
            onCompleted={() => setCreatingInStatus(null)}
            projectId={projectId}
            statusId={selectedStatus.id}
          />
        </Modal>
      ) : null}
    </>
  );
}

function groupTasks(
  statuses: TaskStatusSummary[],
  tasks: TaskSummary[],
): TaskGroups {
  const groups = Object.fromEntries(
    statuses.map((status) => [status.id, [] as TaskSummary[]]),
  );

  for (const task of tasks) groups[task.statusId]?.push(task);
  return groups;
}

function cloneGroups(groups: TaskGroups): TaskGroups {
  return Object.fromEntries(
    Object.entries(groups).map(([statusId, tasks]) => [statusId, [...tasks]]),
  );
}

function findTask(groups: TaskGroups, taskId: string) {
  for (const [statusId, tasks] of Object.entries(groups)) {
    const index = tasks.findIndex(({ id }) => id === taskId);
    if (index >= 0) return { index, statusId, tasks };
  }
  return null;
}
