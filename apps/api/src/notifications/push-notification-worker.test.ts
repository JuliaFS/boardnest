import { describe, expect, it, vi } from 'vitest';

import { createPushNotificationWorker } from './push-notification-worker.js';

const delivery = {
  attempt_count: 1,
  device_id: '4a6800a7-e0f9-4073-84f8-7e93b8679fbb',
  id: '3f7ed15a-f764-453e-9739-643f088f3a29',
  lock_token: 'c96d8809-2a8a-46b7-ab99-8bddb65b6420',
  max_attempts: 5,
  payload: {
    eventType: 'task.assigned',
    title: 'Task assigned',
    workspaceId: '9a18895f-bb7a-47ba-89c7-2058e595f21f',
  },
  push_token: 'ExpoPushToken[test-token]',
};

describe('push notification worker', () => {
  it('records an Expo ticket for a claimed delivery', async () => {
    const rpc = vi.fn((name: string) => {
      if (name === 'claim_push_notification_deliveries') {
        return Promise.resolve({ data: [delivery], error: null });
      }
      if (name === 'claim_push_notification_receipts') {
        return Promise.resolve({ data: [], error: null });
      }
      return Promise.resolve({ data: true, error: null });
    });
    const fetchImplementation = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ data: { id: 'expo-ticket', status: 'ok' } }),
          { status: 200 },
        ),
      ),
    );
    const worker = createPushNotificationWorker({
      batchSize: 10,
      client: { rpc },
      fetchImplementation,
      intervalMs: 10_000,
    });

    await expect(worker.runOnce()).resolves.toEqual({
      claimed: 1,
      delivered: 0,
      failed: 0,
      tickets: 1,
    });
    expect(rpc).toHaveBeenCalledWith('record_push_notification_ticket', {
      p_delivery_id: delivery.id,
      p_lock_token: delivery.lock_token,
      p_ticket_id: 'expo-ticket',
    });
  });

  it('revokes a device when Expo reports DeviceNotRegistered', async () => {
    const rpc = vi.fn((name: string) => {
      if (name === 'claim_push_notification_deliveries') {
        return Promise.resolve({ data: [delivery], error: null });
      }
      if (name === 'claim_push_notification_receipts') {
        return Promise.resolve({ data: [], error: null });
      }
      return Promise.resolve({ data: true, error: null });
    });
    const fetchImplementation = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
              details: { error: 'DeviceNotRegistered' },
              message: 'Device is not registered.',
              status: 'error',
            },
          }),
          { status: 200 },
        ),
      ),
    );
    const worker = createPushNotificationWorker({
      batchSize: 10,
      client: { rpc },
      fetchImplementation,
      intervalMs: 10_000,
    });

    await expect(worker.runOnce()).resolves.toMatchObject({ failed: 1 });
    expect(rpc).toHaveBeenCalledWith('fail_push_notification_delivery', {
      p_delivery_id: delivery.id,
      p_error_code: 'DeviceNotRegistered',
      p_error_message: 'Device is not registered.',
      p_lock_token: delivery.lock_token,
      p_retryable: false,
      p_revoke_device: true,
    });
  });
});
