export type BoardStatus = { id: string; position: number };

export type BoardTask = {
  id: string;
  position: number;
  statusId: string;
};

export type TaskColumns<TTask extends BoardTask> = Record<string, TTask[]>;

export function groupTasksByStatus<TTask extends BoardTask>(
  statuses: readonly BoardStatus[],
  tasks: readonly TTask[],
): TaskColumns<TTask> {
  const columns: TaskColumns<TTask> = Object.fromEntries(
    [...statuses]
      .sort((left, right) => left.position - right.position)
      .map((status) => [status.id, [] as TTask[]]),
  );

  for (const task of tasks) {
    (columns[task.statusId] ??= []).push(task);
  }
  for (const column of Object.values(columns)) {
    column.sort((left, right) => left.position - right.position);
  }
  return columns;
}

export function moveTaskOptimistically<TTask extends BoardTask>(
  columns: TaskColumns<TTask>,
  taskId: string,
  targetStatusId: string,
  position: number,
) {
  const before = cloneColumns(columns);
  const task = Object.values(columns)
    .flat()
    .find((candidate) => candidate.id === taskId);
  if (!task) return { before, next: before };

  const next = cloneColumns(columns);
  for (const statusId of Object.keys(next)) {
    next[statusId] = next[statusId]?.filter((item) => item.id !== taskId) ?? [];
  }
  const moved = { ...task, position, statusId: targetStatusId };
  (next[targetStatusId] ??= []).push(moved);
  next[targetStatusId]?.sort((left, right) => left.position - right.position);
  return { before, next };
}

export function restoreTaskColumns<TTask extends BoardTask>(
  snapshot: TaskColumns<TTask>,
) {
  return cloneColumns(snapshot);
}

function cloneColumns<TTask extends BoardTask>(columns: TaskColumns<TTask>) {
  return Object.fromEntries(
    Object.entries(columns).map(([statusId, tasks]) => [
      statusId,
      tasks.map((task) => ({ ...task })),
    ]),
  ) as TaskColumns<TTask>;
}
