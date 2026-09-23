import { describe, expect, it } from 'vitest';

import type { TaskStatusSummary, TaskSummary } from '../core/graphql';
import { groupTasks, removeTask, upsertTask } from './task-groups';

const status = {
  category: 'todo',
  color: '#64748b',
  id: 'status-1',
  name: 'To do',
  position: 1,
  projectId: 'project-1',
} satisfies TaskStatusSummary;
const task = {
  description: null,
  dueAt: null,
  id: 'task-1',
  position: 1000,
  priority: 'MEDIUM',
  projectId: status.projectId,
  statusId: status.id,
  title: 'Initial title',
  updatedAt: new Date(0).toISOString(),
} satisfies TaskSummary;

describe('real-time task groups', () => {
  it('inserts and replaces subscription task payloads without duplicates', () => {
    const initial = groupTasks([status], [task]);
    const updated = upsertTask(initial, {
      ...task,
      position: 500,
      title: 'Updated title',
    });

    expect(updated[status.id]).toHaveLength(1);
    expect(updated[status.id]?.[0]).toMatchObject({
      position: 500,
      title: 'Updated title',
    });
  });

  it('removes a deleted subscription task payload', () => {
    expect(
      removeTask(groupTasks([status], [task]), task.id)[status.id],
    ).toEqual([]);
  });
});
