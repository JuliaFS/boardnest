import { createClient } from 'redis';
import { z } from 'zod';

import { AsyncEventQueue } from './async-event-queue.js';
import type {
  RealtimeEventBus,
  SyncEvent,
  SyncEventKind,
  TaskEvent,
  TaskEventKind,
} from './event-bus.js';

type MessageListener = (message: string, channel: string) => void;

export interface RedisPublisher {
  close: () => Promise<void>;
  publish: (channel: string, message: string) => Promise<number>;
}

export interface RedisSubscriber {
  close: () => Promise<void>;
  subscribe: (channel: string, listener: MessageListener) => Promise<unknown>;
  unsubscribe: (channel: string, listener: MessageListener) => Promise<unknown>;
}

interface RedisEventBusOptions {
  onError?: (error: unknown) => void;
  publisher: RedisPublisher;
  subscriber: RedisSubscriber;
}

const taskSchema = z.object({
  archived_at: z.string().nullable(),
  created_at: z.string(),
  created_by: z.uuid().nullable(),
  description: z.string().nullable(),
  due_at: z.string().nullable(),
  id: z.uuid(),
  position: z.number().finite().nonnegative(),
  priority: z.string(),
  project_id: z.uuid(),
  status_id: z.uuid(),
  title: z.string(),
  updated_at: z.string(),
});
const taskEventSchema = z
  .discriminatedUnion('kind', [
    z.object({
      kind: z.enum(['created', 'updated']),
      projectId: z.uuid(),
      task: taskSchema,
      taskId: z.uuid(),
    }),
    z.object({
      kind: z.literal('deleted'),
      projectId: z.uuid(),
      task: z.null(),
      taskId: z.uuid(),
    }),
  ])
  .refine(
    (event) =>
      event.task === null ||
      (event.task.id === event.taskId &&
        event.task.project_id === event.projectId),
    'Task event identifiers do not match the task payload.',
  );
const syncEventSchema = z.object({
  id: z.uuid(),
  kind: z.enum(['project_membership', 'task_comment', 'workspace_membership']),
  occurredAt: z.string(),
  projectId: z.uuid().nullable(),
  taskId: z.uuid().nullable(),
  workspaceId: z.uuid().nullable(),
});

export async function createRedisEventBus(
  url: string,
  onError: (error: unknown) => void = defaultErrorHandler,
): Promise<RealtimeEventBus> {
  const publisher = createClient({ url });
  const subscriber = publisher.duplicate();
  publisher.on('error', onError);
  subscriber.on('error', onError);

  try {
    await Promise.all([publisher.connect(), subscriber.connect()]);
  } catch (error) {
    publisher.destroy();
    subscriber.destroy();
    throw error;
  }

  return createRedisEventBusFromClients({ onError, publisher, subscriber });
}

export function createRedisEventBusFromClients({
  onError = defaultErrorHandler,
  publisher,
  subscriber,
}: RedisEventBusOptions): RealtimeEventBus {
  const subscriptions = new Set<AsyncEventQueue<TaskEvent>>();
  const syncSubscriptions = new Set<AsyncEventQueue<SyncEvent>>();
  let closed = false;
  let closing = false;

  return {
    async close() {
      if (closed || closing) return;
      closing = true;
      const unsubscribeResults = await Promise.allSettled(
        [...subscriptions, ...syncSubscriptions].map((queue) =>
          queue.return().then(() => undefined),
        ),
      );
      const closeResults = await Promise.allSettled([
        subscriber.close(),
        publisher.close(),
      ]);
      closed = true;
      closing = false;
      const failure = [...unsubscribeResults, ...closeResults].find(
        (result) => result.status === 'rejected',
      );
      if (failure?.status === 'rejected') throw failure.reason;
    },

    async publishTask(event) {
      if (closed || closing) return;
      try {
        await publisher.publish(
          taskChannel(event.projectId, event.kind),
          encodeTaskEvent(event),
        );
      } catch (error) {
        onError(error);
      }
    },

    async publishSync(event) {
      if (closed || closing) return;
      try {
        await publisher.publish(
          syncChannel(syncScopeId(event), event.kind),
          encodeSyncEvent(event),
        );
      } catch (error) {
        onError(error);
      }
    },

    async subscribeToTasks(projectId, kind) {
      if (closed || closing) throw new Error('The Redis event bus is closed.');
      const channel = taskChannel(projectId, kind);
      const queue = new AsyncEventQueue<TaskEvent>(async () => {
        subscriptions.delete(queue);
        if (!closed) await subscriber.unsubscribe(channel, listener);
      });
      const listener: MessageListener = (message) => {
        try {
          const event = decodeTaskEvent(message);
          if (event.projectId === projectId && event.kind === kind) {
            queue.push(event);
          }
        } catch (error) {
          onError(error);
        }
      };
      subscriptions.add(queue);

      try {
        await subscriber.subscribe(channel, listener);
      } catch (error) {
        subscriptions.delete(queue);
        throw error;
      }
      return queue;
    },

    async subscribeToSync(scopeId, kind) {
      if (closed || closing) throw new Error('The Redis event bus is closed.');
      const channel = syncChannel(scopeId, kind);
      const queue = new AsyncEventQueue<SyncEvent>(async () => {
        syncSubscriptions.delete(queue);
        if (!closed) await subscriber.unsubscribe(channel, listener);
      });
      const listener: MessageListener = (message) => {
        try {
          const event = decodeSyncEvent(message);
          if (syncScopeId(event) === scopeId && event.kind === kind) {
            queue.push(event);
          }
        } catch (error) {
          onError(error);
        }
      };
      syncSubscriptions.add(queue);
      try {
        await subscriber.subscribe(channel, listener);
      } catch (error) {
        syncSubscriptions.delete(queue);
        throw error;
      }
      return queue;
    },
  };
}

export function encodeTaskEvent(event: TaskEvent): string {
  return JSON.stringify(taskEventSchema.parse(event));
}

export function decodeTaskEvent(message: string): TaskEvent {
  return taskEventSchema.parse(JSON.parse(message) as unknown);
}

export function encodeSyncEvent(event: SyncEvent): string {
  return JSON.stringify(syncEventSchema.parse(event));
}

export function decodeSyncEvent(message: string): SyncEvent {
  return syncEventSchema.parse(JSON.parse(message) as unknown);
}

function taskChannel(projectId: string, kind: TaskEventKind): string {
  return `boardnest:v1:task:${projectId}:${kind}`;
}

function syncChannel(scopeId: string, kind: SyncEventKind): string {
  return `boardnest:v1:sync:${kind}:${scopeId}`;
}

function syncScopeId(event: SyncEvent): string {
  const scopeId =
    event.kind === 'workspace_membership' ? event.workspaceId : event.projectId;
  if (!scopeId) throw new Error('Realtime sync event is missing its scope.');
  return scopeId;
}

function defaultErrorHandler(error: unknown): void {
  console.error('Redis event bus error', error);
}
