import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type { EmailMessage, MailTransport } from '../email/smtp-transport.js';

interface DeliveryRpcClient {
  rpc: (
    name: string,
    parameters: Record<string, unknown>,
  ) => PromiseLike<{
    data: unknown;
    error: { code?: string; message: string } | null;
  }>;
}

interface NotificationDeliveryWorkerOptions {
  batchSize: number;
  client: DeliveryRpcClient;
  from: string;
  intervalMs: number;
  onError?: (error: unknown) => void;
  onRun?: (result: DeliveryRunResult) => void;
  transport: MailTransport;
}

export interface DeliveryRunResult {
  claimed: number;
  delivered: number;
  failed: number;
}

export interface NotificationDeliveryWorker {
  close: () => Promise<void>;
  runOnce: () => Promise<DeliveryRunResult>;
  start: () => void;
}

const claimedDeliverySchema = z.object({
  attempt_count: z.number().int().positive(),
  id: z.uuid(),
  idempotency_key: z.string().min(16),
  lock_token: z.uuid(),
  max_attempts: z.number().int().positive(),
  payload: z.record(z.string(), z.unknown()),
  recipient_email: z.email().nullable(),
  scheduled_for: z.string(),
});
type ClaimedDelivery = z.infer<typeof claimedDeliverySchema>;

const sendResultSchema = z
  .object({ messageId: z.string().trim().min(1).max(500) })
  .passthrough();

export function createSupabaseNotificationDeliveryWorker(options: {
  batchSize: number;
  from: string;
  intervalMs: number;
  serviceRoleKey: string;
  supabaseUrl: string;
  transport: MailTransport;
}): NotificationDeliveryWorker {
  const client = createClient(options.supabaseUrl, options.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return createNotificationDeliveryWorker({
    batchSize: options.batchSize,
    client,
    from: options.from,
    intervalMs: options.intervalMs,
    transport: options.transport,
  });
}

export function createNotificationDeliveryWorker({
  batchSize,
  client,
  from,
  intervalMs,
  onError = defaultErrorHandler,
  onRun = defaultRunHandler,
  transport,
}: NotificationDeliveryWorkerOptions): NotificationDeliveryWorker {
  let activeRun: Promise<DeliveryRunResult> | null = null;
  let closed = false;
  let timer: NodeJS.Timeout | null = null;

  const runOnce = (): Promise<DeliveryRunResult> => {
    if (closed)
      return Promise.reject(
        new Error('Notification delivery worker is closed.'),
      );
    if (activeRun) return activeRun;

    activeRun = processDeliveryBatch(client, transport, from).finally(() => {
      activeRun = null;
    });
    return activeRun;
  };

  const processDeliveryBatch = async (
    rpcClient: DeliveryRpcClient,
    mailTransport: MailTransport,
    sender: string,
  ): Promise<DeliveryRunResult> => {
    const claimed = await claimDeliveries(rpcClient, batchSize);
    const result: DeliveryRunResult = {
      claimed: claimed.length,
      delivered: 0,
      failed: 0,
    };

    for (const delivery of claimed) {
      let sendResult: z.infer<typeof sendResultSchema>;

      try {
        if (!delivery.recipient_email) {
          throw new PermanentDeliveryError(
            'RECIPIENT_EMAIL_MISSING',
            'The notification recipient does not have an email address.',
          );
        }

        sendResult = sendResultSchema.parse(
          await mailTransport.sendMail(
            createNotificationMessage(delivery, sender),
          ),
        );
      } catch (error) {
        const failure = classifyDeliveryError(error);
        await failDelivery(rpcClient, delivery, failure);
        result.failed += 1;
        continue;
      }

      // Do not record an SMTP failure after the provider has already accepted
      // the message. A stale lease can be reclaimed safely if this RPC fails.
      await completeDelivery(rpcClient, delivery, sendResult.messageId);
      result.delivered += 1;
    }

    return result;
  };

  const tick = async (): Promise<void> => {
    try {
      const result = await runOnce();
      if (result.claimed > 0) onRun(result);
    } catch (error) {
      onError(error);
    }
  };

  return {
    async close() {
      if (closed) return;
      closed = true;
      if (timer) clearInterval(timer);
      timer = null;
      await activeRun?.catch(() => undefined);
    },

    runOnce,

    start() {
      if (closed) throw new Error('Notification delivery worker is closed.');
      if (timer) return;
      void tick();
      timer = setInterval(() => void tick(), intervalMs);
      timer.unref();
    },
  };
}

async function claimDeliveries(
  client: DeliveryRpcClient,
  batchSize: number,
): Promise<ClaimedDelivery[]> {
  const response = await client.rpc('claim_notification_deliveries', {
    p_batch_size: batchSize,
  });
  throwForRpcError('claim', response.error);
  return z.array(claimedDeliverySchema).parse(response.data);
}

async function completeDelivery(
  client: DeliveryRpcClient,
  delivery: ClaimedDelivery,
  providerMessageId: string,
): Promise<void> {
  const response = await client.rpc('complete_notification_delivery', {
    p_delivery_id: delivery.id,
    p_lock_token: delivery.lock_token,
    p_provider_message_id: providerMessageId,
  });
  throwForRpcError('complete', response.error);
  if (response.data !== true) {
    throw new Error('Notification delivery lease expired before completion.');
  }
}

interface ClassifiedDeliveryError {
  code: string;
  message: string;
  retryable: boolean;
}

async function failDelivery(
  client: DeliveryRpcClient,
  delivery: ClaimedDelivery,
  failure: ClassifiedDeliveryError,
): Promise<void> {
  const response = await client.rpc('fail_notification_delivery', {
    p_delivery_id: delivery.id,
    p_error_code: failure.code,
    p_error_message: failure.message,
    p_lock_token: delivery.lock_token,
    p_retryable: failure.retryable,
  });
  throwForRpcError('fail', response.error);
  if (response.data !== true) {
    throw new Error(
      'Notification delivery lease expired before failure was recorded.',
    );
  }
}

function createNotificationMessage(
  delivery: ClaimedDelivery,
  from: string,
): EmailMessage {
  const taskTitle = readPayloadString(delivery.payload, 'taskTitle');
  const title =
    readPayloadString(delivery.payload, 'title') ??
    (taskTitle ? `Reminder: ${taskTitle}` : 'Boardnest notification');
  const body =
    readPayloadString(delivery.payload, 'body') ??
    (taskTitle
      ? `Your scheduled reminder for “${taskTitle}” is due.`
      : 'You have a new notification in Boardnest.');

  return {
    from,
    headers: { 'X-Boardnest-Delivery-ID': delivery.id },
    html: `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p>`,
    messageId: `<notification-${delivery.id}@boardnest.local>`,
    subject: title,
    text: `${title}\n\n${body}`,
    to: delivery.recipient_email ?? '',
  };
}

export function classifyDeliveryError(error: unknown): ClassifiedDeliveryError {
  if (error instanceof PermanentDeliveryError) {
    return { code: error.code, message: error.message, retryable: false };
  }

  const candidate = error as {
    code?: unknown;
    message?: unknown;
    responseCode?: unknown;
  };
  const code = normalizeErrorCode(candidate?.code);
  const responseCode =
    typeof candidate?.responseCode === 'number'
      ? candidate.responseCode
      : undefined;
  const retryable =
    responseCode !== undefined
      ? responseCode >= 400 && responseCode < 500
      : !['EAUTH', 'EENVELOPE', 'EMESSAGE'].includes(code);

  return {
    code,
    message: normalizeErrorMessage(candidate?.message),
    retryable,
  };
}

class PermanentDeliveryError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PermanentDeliveryError';
  }
}

function readPayloadString(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const value = payload[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeErrorCode(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return 'SMTP_DELIVERY_FAILED';
  return value.trim().slice(0, 120);
}

function normalizeErrorMessage(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    return 'The SMTP provider rejected the notification email.';
  }
  return value.trim().slice(0, 4000);
}

function throwForRpcError(
  operation: string,
  error: { message: string } | null,
): void {
  if (error) {
    throw new Error(
      `Notification delivery ${operation} RPC failed: ${error.message}`,
    );
  }
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '"': '&quot;',
        '&': '&amp;',
        "'": '&#039;',
        '<': '&lt;',
        '>': '&gt;',
      })[character] ?? character,
  );
}

function defaultErrorHandler(error: unknown): void {
  console.error('Notification delivery worker error', error);
}

function defaultRunHandler(result: DeliveryRunResult): void {
  console.info(
    `Notification delivery batch: ${result.claimed} claimed, ${result.delivered} delivered, ${result.failed} failed`,
  );
}
