import { describe, expect, it, vi } from 'vitest';

import { createReminderScheduler } from './reminder-scheduler.js';

describe('reminder scheduler', () => {
  it('processes a bounded batch through the trusted RPC', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: 3, error: null }),
    };
    const scheduler = createReminderScheduler({
      batchSize: 25,
      client,
      intervalMs: 30_000,
    });

    await expect(scheduler.runOnce()).resolves.toBe(3);
    expect(client.rpc).toHaveBeenCalledWith('process_due_task_reminders', {
      p_batch_size: 25,
    });
    await scheduler.close();
  });

  it('coalesces overlapping runs into one database claim', async () => {
    let resolveRpc:
      ((value: { data: number; error: null }) => void) | undefined;
    const client = {
      rpc: vi.fn(
        () =>
          new Promise<{ data: number; error: null }>((resolve) => {
            resolveRpc = resolve;
          }),
      ),
    };
    const scheduler = createReminderScheduler({
      batchSize: 100,
      client,
      intervalMs: 30_000,
    });

    const first = scheduler.runOnce();
    const second = scheduler.runOnce();
    resolveRpc?.({ data: 1, error: null });

    await expect(Promise.all([first, second])).resolves.toEqual([1, 1]);
    expect(client.rpc).toHaveBeenCalledTimes(1);
    await scheduler.close();
  });

  it('reports interval failures without stopping later ticks', async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const onProcessed = vi.fn();
    const client = {
      rpc: vi
        .fn()
        .mockResolvedValueOnce({ data: null, error: { message: 'offline' } })
        .mockResolvedValueOnce({ data: 2, error: null }),
    };
    const scheduler = createReminderScheduler({
      batchSize: 100,
      client,
      intervalMs: 5_000,
      onError,
      onProcessed,
    });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(onError).toHaveBeenCalledOnce();
    expect(onProcessed).toHaveBeenCalledWith(2);
    await scheduler.close();
    vi.useRealTimers();
  });

  it('cannot restart after shutdown', async () => {
    const scheduler = createReminderScheduler({
      batchSize: 100,
      client: { rpc: vi.fn() },
      intervalMs: 30_000,
    });
    await scheduler.close();

    expect(() => scheduler.start()).toThrow('Reminder scheduler is closed.');
    await expect(scheduler.runOnce()).rejects.toThrow(
      'Reminder scheduler is closed.',
    );
  });
});
