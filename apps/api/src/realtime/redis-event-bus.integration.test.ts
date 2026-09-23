import { describe, expect, it } from 'vitest';

import type { Task } from '../graphql/domain.js';
import { createRedisEventBus } from './redis-event-bus.js';

const redisUrl = process.env.REDIS_INTEGRATION_URL;

describe.skipIf(!redisUrl)('Redis event bus integration', () => {
  it('fans out an event between independent real Redis connections', async () => {
    if (!redisUrl) throw new Error('REDIS_INTEGRATION_URL is required.');
    const publisherBus = await createRedisEventBus(redisUrl);
    const subscriberBus = await createRedisEventBus(redisUrl);
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
      title: 'Verify Redis fan-out',
      updated_at: new Date(0).toISOString(),
    } satisfies Task;
    const subscription = (
      await subscriberBus.subscribeToTasks(task.project_id, 'created')
    )[Symbol.asyncIterator]();

    try {
      await publisherBus.publishTask({
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
    } finally {
      await subscription.return?.();
      await Promise.all([publisherBus.close(), subscriberBus.close()]);
    }
  });
});
