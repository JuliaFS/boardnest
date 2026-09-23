import type { Task } from '../graphql/domain.js';
import { AsyncEventQueue } from './async-event-queue.js';

export type TaskEventKind = 'created' | 'deleted' | 'updated';

export interface TaskEvent {
  kind: TaskEventKind;
  projectId: string;
  task: Task | null;
  taskId: string;
}

export interface RealtimeEventBus {
  close: () => Promise<void>;
  publishTask: (event: TaskEvent) => Promise<void>;
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

export function createInMemoryEventBus(): RealtimeEventBus {
  const subscribers = new Set<Subscriber>();

  return {
    async close() {
      await Promise.all(
        [...subscribers].map(({ queue }) =>
          queue.return().then(() => undefined),
        ),
      );
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
  };
}
