import { describe, expect, it } from 'vitest';

import { createEventDeduplicator, taskEventKey } from './realtime-events';

describe('mobile realtime event handling', () => {
  it('accepts an event once and rejects its duplicate', () => {
    const events = createEventDeduplicator();
    expect(events.accept('event-1')).toBe(true);
    expect(events.accept('event-1')).toBe(false);
  });

  it('evicts the oldest event when the bounded history is full', () => {
    const events = createEventDeduplicator(2);
    events.accept('first');
    events.accept('second');
    events.accept('third');
    expect(events.accept('first')).toBe(true);
  });

  it('builds stable task event keys', () => {
    expect(taskEventKey('updated', { id: 'task', updatedAt: 'time' })).toBe(
      'updated:task:time',
    );
    expect(taskEventKey('deleted', 'task')).toBe('deleted:task');
  });
});
