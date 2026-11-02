import { describe, expect, it } from 'vitest';

import {
  groupTasksByStatus,
  moveTaskOptimistically,
  removeTaskFromColumns,
  restoreTaskColumns,
  upsertTaskInColumns,
} from './task-board';

const statuses = [
  { id: 'done', position: 2 },
  { id: 'todo', position: 1 },
];
const tasks = [
  { id: 'second', position: 2000, statusId: 'todo' },
  { id: 'first', position: 1000, statusId: 'todo' },
];

describe('mobile task board state', () => {
  it('groups and orders tasks by status and position', () => {
    expect(groupTasksByStatus(statuses, tasks)).toEqual({
      todo: [tasks[1], tasks[0]],
      done: [],
    });
  });

  it('returns an immutable rollback snapshot for optimistic movement', () => {
    const columns = groupTasksByStatus(statuses, tasks);
    const { before, next } = moveTaskOptimistically(
      columns,
      'first',
      'done',
      1000,
    );

    expect(next.todo?.map((task) => task.id)).toEqual(['second']);
    expect(next.done?.map((task) => task.id)).toEqual(['first']);
    expect(restoreTaskColumns(before)).toEqual(columns);
    expect(columns.todo?.map((task) => task.id)).toEqual(['first', 'second']);
  });

  it('upserts and removes realtime tasks without mutating current columns', () => {
    const columns = groupTasksByStatus(statuses, tasks);
    const updated = upsertTaskInColumns(columns, {
      id: 'first',
      position: 500,
      statusId: 'done',
    });

    expect(updated.todo?.map((task) => task.id)).toEqual(['second']);
    expect(updated.done?.map((task) => task.id)).toEqual(['first']);
    expect(removeTaskFromColumns(updated, 'first').done).toEqual([]);
    expect(columns.todo?.map((task) => task.id)).toEqual(['first', 'second']);
  });
});
