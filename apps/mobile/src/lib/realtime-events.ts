export type EventDeduplicator = {
  accept: (eventKey: string) => boolean;
  clear: () => void;
};

export function createActivityGate(initiallyActive = true) {
  let active = initiallyActive;
  const waiters = new Set<() => void>();
  return {
    setActive(nextActive: boolean) {
      active = nextActive;
      if (!active) return;
      for (const resolve of waiters) resolve();
      waiters.clear();
    },
    waitUntilActive() {
      if (active) return Promise.resolve();
      return new Promise<void>((resolve) => waiters.add(resolve));
    },
  };
}

export function createEventDeduplicator(maxEntries = 500): EventDeduplicator {
  const keys = new Set<string>();
  return {
    accept(eventKey) {
      if (keys.has(eventKey)) return false;
      keys.add(eventKey);
      if (keys.size > maxEntries) {
        const oldest = keys.values().next().value;
        if (oldest) keys.delete(oldest);
      }
      return true;
    },
    clear() {
      keys.clear();
    },
  };
}

export function taskEventKey(
  kind: 'created' | 'deleted' | 'updated',
  task: { id: string; updatedAt?: string } | string,
): string {
  if (typeof task === 'string') return `${kind}:${task}`;
  return `${kind}:${task.id}:${task.updatedAt ?? ''}`;
}
