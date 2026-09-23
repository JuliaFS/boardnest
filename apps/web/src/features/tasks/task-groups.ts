import type { TaskStatusSummary, TaskSummary } from '../core/graphql';

export type TaskGroups = Record<string, TaskSummary[]>;

export function groupTasks(
  statuses: TaskStatusSummary[],
  tasks: TaskSummary[],
): TaskGroups {
  const groups = Object.fromEntries(
    statuses.map((status) => [status.id, [] as TaskSummary[]]),
  );

  for (const task of tasks) groups[task.statusId]?.push(task);
  for (const tasksInStatus of Object.values(groups)) {
    tasksInStatus.sort(compareTasks);
  }
  return groups;
}

export function upsertTask(
  groups: TaskGroups,
  incoming: TaskSummary,
): TaskGroups {
  const next = removeTask(groups, incoming.id);
  const destination = next[incoming.statusId];
  if (!destination) return next;
  destination.push(incoming);
  destination.sort(compareTasks);
  return next;
}

export function removeTask(groups: TaskGroups, taskId: string): TaskGroups {
  return Object.fromEntries(
    Object.entries(groups).map(([statusId, tasks]) => [
      statusId,
      tasks.filter(({ id }) => id !== taskId),
    ]),
  );
}

export function cloneGroups(groups: TaskGroups): TaskGroups {
  return Object.fromEntries(
    Object.entries(groups).map(([statusId, tasks]) => [statusId, [...tasks]]),
  );
}

export function findTask(groups: TaskGroups, taskId: string) {
  for (const [statusId, tasks] of Object.entries(groups)) {
    const index = tasks.findIndex(({ id }) => id === taskId);
    if (index >= 0) return { index, statusId, tasks };
  }
  return null;
}

function compareTasks(left: TaskSummary, right: TaskSummary): number {
  return left.position - right.position || left.id.localeCompare(right.id);
}
