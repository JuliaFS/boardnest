import { describe, expect, it, vi } from 'vitest';

import type { Task } from '../graphql/domain.js';
import {
  createRedisEventBusFromClients,
  decodeTaskEvent,
  encodeTaskEvent,
  type RedisPublisher,
  type RedisSubscriber,
} from './redis-event-bus.js';

type MessageListener = (message: string, channel: string) => void;

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
  title: 'Distribute real-time updates',
  updated_at: new Date(0).toISOString(),
} satisfies Task;

class FakeRedisBroker {
  readonly listeners = new Map<
    string,
    Set<(message: string, channel: string) => void>
  >();

  publisher(): RedisPublisher {
    return {
      close: vi.fn().mockResolvedValue(undefined),
      publish: vi.fn((channel: string, message: string) => {
        for (const listener of this.listeners.get(channel) ?? []) {
          listener(message, channel);
        }
        return Promise.resolve(this.listeners.get(channel)?.size ?? 0);
      }),
    };
  }

  subscriber(): RedisSubscriber {
    return {
      close: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn((channel: string, listener: MessageListener) => {
        const listeners = this.listeners.get(channel) ?? new Set();
        listeners.add(listener);
        this.listeners.set(channel, listeners);
        return Promise.resolve();
      }),
      unsubscribe: vi.fn((channel: string, listener: MessageListener) => {
        this.listeners.get(channel)?.delete(listener);
        return Promise.resolve();
      }),
    };
  }
}

describe('Redis real-time event bus', () => {
  it('distributes task events between separate event bus instances', async () => {
    const broker = new FakeRedisBroker();
    const publisherBus = createRedisEventBusFromClients({
      publisher: broker.publisher(),
      subscriber: broker.subscriber(),
    });
    const subscriberBus = createRedisEventBusFromClients({
      publisher: broker.publisher(),
      subscriber: broker.subscriber(),
    });
    const subscription = (
      await subscriberBus.subscribeToTasks(task.project_id, 'updated')
    )[Symbol.asyncIterator]();
    const event = {
      kind: 'updated',
      projectId: task.project_id,
      task,
      taskId: task.id,
    } as const;

    await publisherBus.publishTask(event);

    await expect(subscription.next()).resolves.toEqual({
      done: false,
      value: event,
    });
    await subscription.return?.();
    await Promise.all([publisherBus.close(), subscriberBus.close()]);
  });

  it('round-trips valid events and rejects inconsistent payloads', () => {
    const event = {
      kind: 'created',
      projectId: task.project_id,
      task,
      taskId: task.id,
    } as const;

    expect(decodeTaskEvent(encodeTaskEvent(event))).toEqual(event);
    expect(() =>
      decodeTaskEvent(
        JSON.stringify({ ...event, taskId: crypto.randomUUID() }),
      ),
    ).toThrow();
  });

  it('reports publish failures without failing an already persisted mutation', async () => {
    const onError = vi.fn();
    const bus = createRedisEventBusFromClients({
      onError,
      publisher: {
        close: vi.fn().mockResolvedValue(undefined),
        publish: vi.fn().mockRejectedValue(new Error('Redis unavailable')),
      },
      subscriber: new FakeRedisBroker().subscriber(),
    });

    await expect(
      bus.publishTask({
        kind: 'deleted',
        projectId: task.project_id,
        task: null,
        taskId: task.id,
      }),
    ).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledOnce();
    await bus.close();
  });
});
