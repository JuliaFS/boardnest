import { describe, expect, it } from 'vitest';

import { createActivityGate } from './realtime-events';

describe('mobile realtime activity gate', () => {
  it('pauses reconnect work until the application becomes active', async () => {
    const gate = createActivityGate(false);
    let resumed = false;
    const waiting = gate.waitUntilActive().then(() => {
      resumed = true;
    });
    await Promise.resolve();
    expect(resumed).toBe(false);
    gate.setActive(true);
    await waiting;
    expect(resumed).toBe(true);
  });
});
