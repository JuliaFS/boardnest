import { describe, expect, it, vi } from 'vitest';

import type { EmailMessage } from '../email/smtp-transport.js';
import {
  classifyDeliveryError,
  createNotificationDeliveryWorker,
} from './notification-delivery-worker.js';

const delivery = {
  attempt_count: 1,
  id: 'd42be78d-9c2c-45f7-b55d-f6e71bf3d41d',
  idempotency_key: 'task-reminder:test-delivery',
  lock_token: 'd74d9198-e272-4382-af91-6669688103f6',
  max_attempts: 5,
  payload: {
    taskTitle: 'Ship <release>',
  },
  recipient_email: 'member@example.com',
  scheduled_for: '2030-01-15T08:00:00.000Z',
};

describe('notification delivery worker', () => {
  it('claims, sends, and completes a notification email', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: [delivery], error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    const sendMail = vi
      .fn<(message: EmailMessage) => Promise<unknown>>()
      .mockResolvedValue({ messageId: 'smtp-message-id' });
    const worker = createNotificationDeliveryWorker({
      batchSize: 10,
      client: { rpc },
      from: 'Boardnest <boardnest@gmail.com>',
      intervalMs: 15_000,
      transport: { sendMail },
    });

    await expect(worker.runOnce()).resolves.toEqual({
      claimed: 1,
      delivered: 1,
      failed: 0,
    });
    expect(rpc).toHaveBeenNthCalledWith(1, 'claim_notification_deliveries', {
      p_batch_size: 10,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'complete_notification_delivery', {
      p_delivery_id: delivery.id,
      p_lock_token: delivery.lock_token,
      p_provider_message_id: 'smtp-message-id',
    });
    const sentMessage = sendMail.mock.calls[0]?.[0];
    expect(sentMessage?.html).toContain('Ship &lt;release&gt;');
    expect(sentMessage?.messageId).toBe(
      `<notification-${delivery.id}@boardnest.local>`,
    );
    expect(sentMessage?.subject).toBe('Reminder: Ship <release>');
    expect(sentMessage?.to).toBe('member@example.com');
    await worker.close();
  });

  it('records retryable SMTP failures without aborting the batch', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: [delivery], error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    const smtpError = Object.assign(new Error('Temporary SMTP rejection'), {
      code: 'EDELIVERY',
      responseCode: 451,
    });
    const worker = createNotificationDeliveryWorker({
      batchSize: 25,
      client: { rpc },
      from: 'Boardnest <boardnest@gmail.com>',
      intervalMs: 15_000,
      transport: { sendMail: vi.fn().mockRejectedValue(smtpError) },
    });

    await expect(worker.runOnce()).resolves.toEqual({
      claimed: 1,
      delivered: 0,
      failed: 1,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'fail_notification_delivery', {
      p_delivery_id: delivery.id,
      p_error_code: 'EDELIVERY',
      p_error_message: 'Temporary SMTP rejection',
      p_lock_token: delivery.lock_token,
      p_retryable: true,
    });
    await worker.close();
  });

  it('marks missing recipient email as a permanent failure', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: [{ ...delivery, recipient_email: null }],
        error: null,
      })
      .mockResolvedValueOnce({ data: true, error: null });
    const sendMail = vi.fn();
    const worker = createNotificationDeliveryWorker({
      batchSize: 25,
      client: { rpc },
      from: 'Boardnest <boardnest@gmail.com>',
      intervalMs: 15_000,
      transport: { sendMail },
    });

    await worker.runOnce();

    expect(sendMail).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenNthCalledWith(
      2,
      'fail_notification_delivery',
      expect.objectContaining({
        p_error_code: 'RECIPIENT_EMAIL_MISSING',
        p_retryable: false,
      }),
    );
    await worker.close();
  });

  it('coalesces overlapping runs without closing its injected transport', async () => {
    let resolveClaim:
      ((value: { data: never[]; error: null }) => void) | undefined;
    const rpc = vi.fn(
      () =>
        new Promise<{ data: never[]; error: null }>((resolve) => {
          resolveClaim = resolve;
        }),
    );
    const close = vi.fn();
    const worker = createNotificationDeliveryWorker({
      batchSize: 25,
      client: { rpc },
      from: 'Boardnest <boardnest@gmail.com>',
      intervalMs: 15_000,
      transport: { close, sendMail: vi.fn() },
    });

    const first = worker.runOnce();
    const second = worker.runOnce();
    resolveClaim?.({ data: [], error: null });

    await expect(Promise.all([first, second])).resolves.toEqual([
      { claimed: 0, delivered: 0, failed: 0 },
      { claimed: 0, delivered: 0, failed: 0 },
    ]);
    expect(rpc).toHaveBeenCalledOnce();
    await worker.close();
    await worker.close();
    expect(close).not.toHaveBeenCalled();
  });

  it('allows independent worker replicas to process disjoint claims concurrently', async () => {
    const secondDelivery = {
      ...delivery,
      id: '25193f72-bab5-44fc-8e81-2cac99507fcc',
      idempotency_key: 'task-reminder:replica-delivery',
      lock_token: 'e8ac2376-5fc1-43b5-8052-e30dc332e47d',
    };
    const available = [delivery, secondDelivery];
    const rpc = vi.fn((name: string) => {
      if (name === 'claim_notification_deliveries') {
        const next = available.shift();
        return Promise.resolve({ data: next ? [next] : [], error: null });
      }
      return Promise.resolve({ data: true, error: null });
    });
    const firstTransport = {
      sendMail: vi
        .fn<(message: EmailMessage) => Promise<unknown>>()
        .mockResolvedValue({ messageId: 'replica-1' }),
    };
    const secondTransport = {
      sendMail: vi
        .fn<(message: EmailMessage) => Promise<unknown>>()
        .mockResolvedValue({ messageId: 'replica-2' }),
    };
    const firstWorker = createNotificationDeliveryWorker({
      batchSize: 1,
      client: { rpc },
      from: 'Boardnest <boardnest@gmail.com>',
      intervalMs: 15_000,
      transport: firstTransport,
    });
    const secondWorker = createNotificationDeliveryWorker({
      batchSize: 1,
      client: { rpc },
      from: 'Boardnest <boardnest@gmail.com>',
      intervalMs: 15_000,
      transport: secondTransport,
    });

    await expect(
      Promise.all([firstWorker.runOnce(), secondWorker.runOnce()]),
    ).resolves.toEqual([
      { claimed: 1, delivered: 1, failed: 0 },
      { claimed: 1, delivered: 1, failed: 0 },
    ]);
    expect(firstTransport.sendMail).toHaveBeenCalledOnce();
    expect(secondTransport.sendMail).toHaveBeenCalledOnce();
    expect(
      new Set([
        firstTransport.sendMail.mock.calls[0]?.[0].messageId,
        secondTransport.sendMail.mock.calls[0]?.[0].messageId,
      ]),
    ).toEqual(
      new Set([
        `<notification-${delivery.id}@boardnest.local>`,
        `<notification-${secondDelivery.id}@boardnest.local>`,
      ]),
    );
    await Promise.all([firstWorker.close(), secondWorker.close()]);
  });

  it('does not record an SMTP failure after the provider accepted the email', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: [delivery], error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Database temporarily unavailable' },
      });
    const worker = createNotificationDeliveryWorker({
      batchSize: 25,
      client: { rpc },
      from: 'Boardnest <boardnest@gmail.com>',
      intervalMs: 15_000,
      transport: {
        sendMail: vi.fn().mockResolvedValue({ messageId: 'accepted-id' }),
      },
    });

    await expect(worker.runOnce()).rejects.toThrow(
      'Notification delivery complete RPC failed',
    );
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).not.toHaveBeenCalledWith(
      'fail_notification_delivery',
      expect.anything(),
    );
    await worker.close();
  });

  it('uses the same deterministic Message-ID when a retry is sent again', async () => {
    const retryDelivery = {
      ...delivery,
      attempt_count: 2,
      lock_token: 'ad90840b-e7e6-4678-b593-400ea06a118a',
    };
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: [delivery], error: null })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: [retryDelivery], error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    const sendMail = vi
      .fn<(message: EmailMessage) => Promise<unknown>>()
      .mockRejectedValueOnce(
        Object.assign(new Error('Temporary provider timeout'), {
          code: 'ETIMEDOUT',
        }),
      )
      .mockResolvedValueOnce({ messageId: 'provider-retry-id' });
    const worker = createNotificationDeliveryWorker({
      batchSize: 10,
      client: { rpc },
      from: 'Boardnest <boardnest@gmail.com>',
      intervalMs: 15_000,
      transport: { sendMail },
    });

    await expect(worker.runOnce()).resolves.toMatchObject({ failed: 1 });
    await expect(worker.runOnce()).resolves.toMatchObject({ delivered: 1 });

    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(sendMail.mock.calls[0]?.[0].messageId).toBe(
      `<notification-${delivery.id}@boardnest.local>`,
    );
    expect(sendMail.mock.calls[1]?.[0].messageId).toBe(
      `<notification-${delivery.id}@boardnest.local>`,
    );
    await worker.close();
  });

  it('continues a claimed batch after a permanent email failure', async () => {
    const secondDelivery = {
      ...delivery,
      id: '283efebb-7fc2-4185-808c-166df6d807d2',
      idempotency_key: 'task-reminder:second-delivery',
      lock_token: '1ab668f0-b78f-4936-bf6a-ab5fdbb1132f',
      recipient_email: 'second-member@example.com',
    };
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: [delivery, secondDelivery],
        error: null,
      })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    const sendMail = vi
      .fn<(message: EmailMessage) => Promise<unknown>>()
      .mockRejectedValueOnce(
        Object.assign(new Error('Mailbox unavailable'), {
          code: 'EDELIVERY',
          responseCode: 550,
        }),
      )
      .mockResolvedValueOnce({ messageId: 'second-provider-id' });
    const worker = createNotificationDeliveryWorker({
      batchSize: 10,
      client: { rpc },
      from: 'Boardnest <boardnest@gmail.com>',
      intervalMs: 15_000,
      transport: { sendMail },
    });

    await expect(worker.runOnce()).resolves.toEqual({
      claimed: 2,
      delivered: 1,
      failed: 1,
    });
    expect(rpc).toHaveBeenNthCalledWith(
      2,
      'fail_notification_delivery',
      expect.objectContaining({ p_retryable: false }),
    );
    expect(rpc).toHaveBeenNthCalledWith(
      3,
      'complete_notification_delivery',
      expect.objectContaining({ p_delivery_id: secondDelivery.id }),
    );
    await worker.close();
  });

  it('classifies permanent and transient SMTP responses', () => {
    expect(
      classifyDeliveryError({
        code: 'EDELIVERY',
        message: 'Mailbox unavailable',
        responseCode: 550,
      }),
    ).toEqual({
      code: 'EDELIVERY',
      message: 'Mailbox unavailable',
      retryable: false,
    });
    expect(
      classifyDeliveryError({
        code: 'ETIMEDOUT',
        message: 'Connection timed out',
      }),
    ).toMatchObject({ retryable: true });
    expect(
      classifyDeliveryError({
        code: 'EAUTH',
        message: 'SMTP credentials rejected',
      }),
    ).toMatchObject({ retryable: false });
    expect(
      classifyDeliveryError({
        code: 'EDELIVERY',
        message: 'Provider temporarily unavailable',
        responseCode: 421,
      }),
    ).toMatchObject({ retryable: true });
  });
});
