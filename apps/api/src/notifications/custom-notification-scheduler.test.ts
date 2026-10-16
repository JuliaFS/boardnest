import { describe, expect, it, vi } from 'vitest';

import { createCustomNotificationScheduler } from './custom-notification-scheduler.js';

describe('custom notification scheduler', () => {
  it('processes a bounded batch through the trusted RPC', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: 4, error: null }),
    };
    const scheduler = createCustomNotificationScheduler({
      batchSize: 50,
      client,
      intervalMs: 30_000,
    });

    await expect(scheduler.runOnce()).resolves.toBe(4);
    expect(client.rpc).toHaveBeenCalledWith(
      'process_due_scheduled_notifications',
      { p_batch_size: 50 },
    );
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
    const scheduler = createCustomNotificationScheduler({
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

  it('allows parallel instances to rely on the database atomic claim', async () => {
    const client = {
      rpc: vi
        .fn()
        .mockResolvedValueOnce({ data: 1, error: null })
        .mockResolvedValueOnce({ data: 0, error: null }),
    };
    const firstScheduler = createCustomNotificationScheduler({
      batchSize: 100,
      client,
      intervalMs: 30_000,
    });
    const secondScheduler = createCustomNotificationScheduler({
      batchSize: 100,
      client,
      intervalMs: 30_000,
    });

    await expect(
      Promise.all([firstScheduler.runOnce(), secondScheduler.runOnce()]),
    ).resolves.toEqual([1, 0]);
    expect(client.rpc).toHaveBeenCalledTimes(2);

    await Promise.all([firstScheduler.close(), secondScheduler.close()]);
  });

  it('recovers on a later tick after an RPC failure', async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const onProcessed = vi.fn();
    const client = {
      rpc: vi
        .fn()
        .mockResolvedValueOnce({ data: null, error: { message: 'offline' } })
        .mockResolvedValueOnce({ data: 2, error: null }),
    };
    const scheduler = createCustomNotificationScheduler({
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
    const scheduler = createCustomNotificationScheduler({
      batchSize: 100,
      client: { rpc: vi.fn() },
      intervalMs: 30_000,
    });
    await scheduler.close();

    expect(() => scheduler.start()).toThrow(
      'Custom notification scheduler is closed.',
    );
    await expect(scheduler.runOnce()).rejects.toThrow(
      'Custom notification scheduler is closed.',
    );
  });
});
