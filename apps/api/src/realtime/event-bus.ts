import type { Task } from '../graphql/domain.js';
import { AsyncEventQueue } from './async-event-queue.js';

export type TaskEventKind = 'created' | 'deleted' | 'updated';

export interface TaskEvent {
  kind: TaskEventKind;
  projectId: string;
  task: Task | null;
  taskId: string;
}

export type SyncEventKind =
  'project_membership' | 'task_comment' | 'workspace_membership';

export interface SyncEvent {
  id: string;
  kind: SyncEventKind;
  occurredAt: string;
  projectId: string | null;
  taskId: string | null;
  workspaceId: string | null;
}

export interface RealtimeEventBus {
  close: () => Promise<void>;
  publishSync: (event: SyncEvent) => Promise<void>;
  publishTask: (event: TaskEvent) => Promise<void>;
  subscribeToSync: (
    scopeId: string,
    kind: SyncEventKind,
  ) => Promise<AsyncIterable<SyncEvent>>;
  subscribeToTasks: (
    projectId: string,
    kind: TaskEventKind,
  ) => Promise<AsyncIterable<TaskEvent>>;
}

interface Subscriber {
  kind: TaskEventKind;
  projectId: string;
  queue: AsyncEventQueue<TaskEvent>;
}

interface SyncSubscriber {
  kind: SyncEventKind;
  queue: AsyncEventQueue<SyncEvent>;
  scopeId: string;
}

export function createInMemoryEventBus(): RealtimeEventBus {
  const subscribers = new Set<Subscriber>();
  const syncSubscribers = new Set<SyncSubscriber>();

  return {
    async close() {
      await Promise.all(
        [...subscribers, ...syncSubscribers].map(({ queue }) =>
          queue.return().then(() => undefined),
        ),
      );
    },

    publishSync(event) {
      for (const subscriber of syncSubscribers) {
        const eventScopeId =
          event.kind === 'workspace_membership'
            ? event.workspaceId
            : event.projectId;
        if (
          subscriber.scopeId === eventScopeId &&
          subscriber.kind === event.kind
        ) {
          subscriber.queue.push(event);
        }
      }
      return Promise.resolve();
    },

    publishTask(event) {
      for (const subscriber of subscribers) {
        if (
          subscriber.projectId === event.projectId &&
          subscriber.kind === event.kind
        ) {
          subscriber.queue.push(event);
        }
      }
      return Promise.resolve();
    },

    subscribeToTasks(projectId, kind) {
      const queue = new AsyncEventQueue<TaskEvent>(() => {
        subscribers.delete(subscriber);
      });
      const subscriber = { kind, projectId, queue };
      subscribers.add(subscriber);
      return Promise.resolve(queue);
    },

    subscribeToSync(scopeId, kind) {
      const queue = new AsyncEventQueue<SyncEvent>(() => {
        syncSubscribers.delete(subscriber);
      });
      const subscriber = { kind, queue, scopeId };
      syncSubscribers.add(subscriber);
      return Promise.resolve(queue);
    },
  };
}
