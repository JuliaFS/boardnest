export class AsyncEventQueue<T> implements AsyncIterableIterator<T> {
  readonly #onClose: () => Promise<void> | void;
  readonly #pending: Array<(result: IteratorResult<T>) => void> = [];
  readonly #values: T[] = [];
  #closed = false;

  constructor(onClose: () => Promise<void> | void) {
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

  async return(): Promise<IteratorResult<T>> {
    if (!this.#closed) {
      this.#closed = true;
      for (const resolve of this.#pending.splice(0)) {
        resolve({ done: true, value: undefined });
      }
      this.#values.length = 0;
      await this.#onClose();
    }
    return { done: true, value: undefined };
  }
}
