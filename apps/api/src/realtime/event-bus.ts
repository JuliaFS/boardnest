import type { Task } from '../graphql/domain.js';

export type TaskEventKind = 'created' | 'deleted' | 'updated';

export interface TaskEvent {
  kind: TaskEventKind;
  projectId: string;
  task: Task | null;
  taskId: string;
}

export interface RealtimeEventBus {
  publishTask: (event: TaskEvent) => Promise<void>;
  subscribeToTasks: (
    projectId: string,
    kind: TaskEventKind,
  ) => AsyncIterable<TaskEvent>;
}

interface Subscriber {
  kind: TaskEventKind;
  projectId: string;
  queue: AsyncEventQueue<TaskEvent>;
}

export function createInMemoryEventBus(): RealtimeEventBus {
  const subscribers = new Set<Subscriber>();

  return {
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
      return queue;
    },
  };
}

class AsyncEventQueue<T> implements AsyncIterableIterator<T> {
  readonly #onClose: () => void;
  readonly #pending: Array<(result: IteratorResult<T>) => void> = [];
  readonly #values: T[] = [];
  #closed = false;

  constructor(onClose: () => void) {
    this.#onClose = onClose;
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<T> {
    return this;
  }

  next(): Promise<IteratorResult<T>> {
    const value = this.#values.shift();
    if (value) return Promise.resolve({ done: false, value });
    if (this.#closed) return Promise.resolve({ done: true, value: undefined });

    return new Promise((resolve) => this.#pending.push(resolve));
  }

  push(value: T): void {
    if (this.#closed) return;
    const resolve = this.#pending.shift();
    if (resolve) resolve({ done: false, value });
    else this.#values.push(value);
  }

  return(): Promise<IteratorResult<T>> {
    if (!this.#closed) {
      this.#closed = true;
      this.#onClose();
      for (const resolve of this.#pending.splice(0)) {
        resolve({ done: true, value: undefined });
      }
      this.#values.length = 0;
    }
    return Promise.resolve({ done: true, value: undefined });
  }
}
