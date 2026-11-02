import { describe, expect, it } from 'vitest';

import type { Task } from '../graphql/domain.js';
import { createInMemoryEventBus } from './event-bus.js';

const task = {
  archived_at: null,
  created_at: new Date(0).toISOString(),
  created_by: null,
  description: null,
  due_at: null,
  id: 'f2410cb7-47f6-4af6-8ed9-f1d7a45158fc',
  position: 1000,
  priority: 'medium',
  project_id: '6992c303-a240-4e15-8fcc-461d53756324',
  status_id: 'ae248328-e9e4-4416-a92d-47af95406e4d',
  title: 'Ship real-time updates',
  updated_at: new Date(0).toISOString(),
} satisfies Task;

describe('in-memory real-time event bus', () => {
  it('delivers only matching project and event type messages', async () => {
    const events = createInMemoryEventBus();
    const subscription = (
      await events.subscribeToTasks(task.project_id, 'created')
    )[Symbol.asyncIterator]();

    await events.publishTask({
      kind: 'updated',
      projectId: task.project_id,
      task,
      taskId: task.id,
    });
    await events.publishTask({
      kind: 'created',
      projectId: task.project_id,
      task,
      taskId: task.id,
    });

    await expect(subscription.next()).resolves.toEqual({
      done: false,
      value: {
        kind: 'created',
        projectId: task.project_id,
        task,
        taskId: task.id,
      },
    });
    await subscription.return?.();
  });

  it('completes pending reads when a subscriber disconnects', async () => {
    const events = createInMemoryEventBus();
    const subscription = (
      await events.subscribeToTasks(task.project_id, 'deleted')
    )[Symbol.asyncIterator]();
    const pending = subscription.next();

    await subscription.return?.();

    await expect(pending).resolves.toEqual({ done: true, value: undefined });
  });

  it('delivers comment sync events only to the matching project scope', async () => {
    const events = createInMemoryEventBus();
    const subscription = (
      await events.subscribeToSync(task.project_id, 'task_comment')
    )[Symbol.asyncIterator]();
    const event = {
      id: '2df85234-1a26-42b6-b10f-622e89d6e7ca',
      kind: 'task_comment',
      occurredAt: new Date(0).toISOString(),
      projectId: task.project_id,
      taskId: task.id,
      workspaceId: null,
    } as const;

    await events.publishSync({
      ...event,
      id: '3654dd85-b0a9-495b-842e-405f48257ef6',
      projectId: 'b6067e89-1702-49b6-92f7-d2f2ccbc4685',
    });
    await events.publishSync(event);

    await expect(subscription.next()).resolves.toEqual({
      done: false,
      value: event,
    });
    await subscription.return?.();
  });
});
